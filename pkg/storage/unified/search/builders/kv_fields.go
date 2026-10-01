package builders

import (
	"context"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/storage/unified/fieldpath"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

var kvSourcedFieldsLogger = log.New("kv-sourced-document-builders")

// KVSourceReader is the read side of kv.ResourceKVStore that
// BuildKVFieldSnapshot needs. Satisfied by *kv.ResourceKVStore.
type KVSourceReader interface {
	ScanNamespaceOwnerKey(ctx context.Context, group, resource, ns, owner, key string) ([]kv.ResourceKVItem, error)
}

// kvOwnerKey groups KV-sourced defs by the (owner, key) document they read
// from, so BuildKVFieldSnapshot does one scan per document, not one per
// field.
type kvOwnerKey struct{ owner, key string }

// BuildKVFieldSnapshot reads every KV-sourced def of group/resource in ns and
// returns name -> field -> coerced value. A value that is missing, not a JSON
// object, lacks the path, or fails coercion is absent from the snapshot; that
// is never an error. Only a reader error is returned.
func BuildKVFieldSnapshot(ctx context.Context, r KVSourceReader, group, resourceName, ns string,
	defs []resource.SearchFieldDefinition) (resource.KVFieldSnapshot, error) {
	byOwnerKey := map[kvOwnerKey][]resource.SearchFieldDefinition{}
	for _, def := range defs {
		if !def.IsKVSourced() {
			continue
		}
		ok := kvOwnerKey{owner: def.KVSource.Owner, key: def.KVSource.Key}
		byOwnerKey[ok] = append(byOwnerKey[ok], def)
	}
	if len(byOwnerKey) == 0 {
		return nil, nil
	}

	snapshot := resource.KVFieldSnapshot{}
	for ok, groupDefs := range byOwnerKey {
		items, err := r.ScanNamespaceOwnerKey(ctx, group, resourceName, ns, ok.owner, ok.key)
		if err != nil {
			return nil, fmt.Errorf("scanning %s/%s for %s/%s: %w", ok.owner, ok.key, group, resourceName, err)
		}
		for _, item := range items {
			// Second line of defence: never trust the reader's own
			// filtering. An item whose Owner or Key doesn't exactly match
			// what was asked for is skipped outright, so a reader bug
			// (e.g. a suffix-matching scan) can never leak another
			// owner's or another key's value into a search field.
			if item.Owner != ok.owner || item.Key != ok.key {
				continue
			}
			var doc map[string]any
			if err := json.Unmarshal(item.Value, &doc); err != nil {
				// Not a JSON object: drift the writer produced. Absent, not
				// an error, same as KVDashboardStats today.
				continue
			}
			for _, def := range groupDefs {
				raw, err := fieldpath.Extract(doc, def.KVSource.Path)
				if err != nil || raw == nil {
					continue
				}
				coerced, ok := resource.CoerceSearchFieldValue(raw, def)
				if !ok {
					continue
				}
				fields := snapshot[item.Name]
				if fields == nil {
					fields = map[string]any{}
					snapshot[item.Name] = fields
				}
				fields[def.Name] = coerced
			}
		}
	}
	if len(snapshot) == 0 {
		return nil, nil
	}
	return snapshot, nil
}

// kvSourcedDocumentBuilder composes a standard (or any) inner builder with a
// pre-read KVFieldSnapshot: inner's document, plus the document's
// group/resource's KV-sourced fields from the snapshot, keyed by name.
type kvSourcedDocumentBuilder struct {
	inner    resource.DocumentBuilder
	provider resource.SearchFieldsProvider
	snapshot resource.KVFieldSnapshot
	scanErr  error
}

func (b *kvSourcedDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	doc, err := b.inner.BuildDocument(ctx, key, rv, value)
	if err != nil {
		return nil, err
	}
	fields := b.snapshot[key.Name]
	if len(fields) == 0 {
		return doc, nil
	}
	defs := b.provider.Fields(schema.GroupVersionResource{Group: key.Group, Resource: key.Resource})
	if doc.Fields == nil {
		doc.Fields = map[string]any{}
	}
	for _, def := range defs {
		if !def.IsKVSourced() {
			continue
		}
		if v, ok := fields[def.Name]; ok {
			doc.Fields[def.Name] = v
		}
	}
	return doc, nil
}

func (b *kvSourcedDocumentBuilder) KVFieldSnapshot() (resource.KVFieldSnapshot, bool) {
	return b.snapshot, true
}

// KVFieldSnapshotErr reports the scan error behind the current snapshot, if
// any, so the freshness check can tell "scanned clean, nothing KV-sourced
// found" apart from "the scan itself failed" -- only NewKVSourcedDocumentBuilder's
// callers that know about a scan error can set this; it's otherwise always
// nil.
func (b *kvSourcedDocumentBuilder) KVFieldSnapshotErr() error {
	return b.scanErr
}

var _ resource.DocumentBuilder = (*kvSourcedDocumentBuilder)(nil)
var _ resource.KVFieldSnapshotter = (*kvSourcedDocumentBuilder)(nil)
var _ resource.KVFieldSnapshotErrorReporter = (*kvSourcedDocumentBuilder)(nil)

// NewKVSourcedDocumentBuilder returns a builder whose documents are inner's
// documents plus, for each KV-sourced field of the document's group/resource,
// snapshot[key.Name][field] when present. The result implements
// resource.KVFieldSnapshotter and returns (snapshot, true).
func NewKVSourcedDocumentBuilder(inner resource.DocumentBuilder, provider resource.SearchFieldsProvider,
	snapshot resource.KVFieldSnapshot) resource.DocumentBuilder {
	return &kvSourcedDocumentBuilder{inner: inner, provider: provider, snapshot: snapshot}
}

// KVSourcedDocumentBuilders returns one namespaced DocumentBuilderInfo per
// kind in registry.KVSourcedKinds() that is not in skip. It returns none when
// r is nil.
func KVSourcedDocumentBuilders(registry *resource.SearchFieldsRegistry, r KVSourceReader,
	skip map[schema.GroupResource]bool) []resource.DocumentBuilderInfo {
	if r == nil || registry == nil {
		return nil
	}
	var out []resource.DocumentBuilderInfo
	for _, kind := range registry.KVSourcedKinds() {
		gr := schema.GroupResource(kind)
		if skip[gr] {
			continue
		}
		_, _, provider := registry.For(kind)
		if provider == nil {
			continue
		}
		group, resourceName := gr.Group, gr.Resource
		out = append(out, resource.DocumentBuilderInfo{
			GroupResource: gr,
			Namespaced: func(ctx context.Context, namespace string, _ resource.BlobSupport) (resource.DocumentBuilder, error) {
				defs := provider.Fields(schema.GroupVersionResource{Group: group, Resource: resourceName})
				snapshot, err := BuildKVFieldSnapshot(ctx, r, group, resourceName, namespace, defs)
				if err != nil {
					// A scan failure is absent data, not a reason to stop
					// indexing the kind: dashboards already treat a failed
					// stats scan this way (see document.go's own builder),
					// so a KV-sourced kind behaves the same way instead of
					// erroring out of its whole builder resolution. The
					// error itself is kept on the builder (see
					// KVFieldSnapshotErr) so the freshness check can tell
					// this apart from a scan that genuinely found nothing.
					kvSourcedFieldsLogger.Warn("failed to scan KV-sourced fields; indexing without them",
						"group", group, "resource", resourceName, "namespace", namespace, "error", err)
					snapshot = nil
				}
				return &kvSourcedDocumentBuilder{
					inner:    resource.StandardDocumentBuilder(registry),
					provider: provider,
					snapshot: snapshot,
					scanErr:  err,
				}, nil
			},
		})
	}
	return out
}
