package builders

import (
	"context"
	"encoding/json"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime/schema"

	dashv0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Snapshot search field names. These are the snapshot-specific fields the
// metadata-only LIST needs to reconstruct a Snapshot without reading the
// (large) dashboard body. Standard fields (title, created, createdBy, ...)
// come from the IndexableDocument metadata and are not redeclared here.
const (
	SNAPSHOT_EXPIRES      = "expires"
	SNAPSHOT_EXTERNAL     = "external"
	SNAPSHOT_EXTERNAL_URL = "externalURL"
	// createdTimestamp mirrors the standard Created value into a returnable
	// field. The top-level Created field has no bleve mapping and is otherwise
	// not retrievable in search results, so the snapshot LIST reads it from here.
	SNAPSHOT_CREATED = "createdTimestamp"
)

// SnapshotSearchFields declares the snapshot-specific searchable fields. They
// are all computed (empty Path): SnapshotDocumentBuilder fills them in from the
// parsed spec so the body is never fully unmarshaled.
var SnapshotSearchFields = []resource.SearchFieldDefinition{
	{
		Name:         SNAPSHOT_EXPIRES,
		Type:         resource.SearchFieldTypeInt64,
		Description:  "Unix timestamp (ms) when the snapshot expires",
		Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve},
	},
	{
		Name:         SNAPSHOT_EXTERNAL,
		Type:         resource.SearchFieldTypeBoolean,
		Description:  "Whether the snapshot lives on a remote server",
		Capabilities: []resource.SearchCapability{resource.SearchCapabilityFilter, resource.SearchCapabilityRetrieve},
	},
	{
		Name:         SNAPSHOT_EXTERNAL_URL,
		Type:         resource.SearchFieldTypeString,
		Description:  "External URL where the snapshot can be seen",
		Capabilities: []resource.SearchCapability{resource.SearchCapabilityRetrieve},
	},
	{
		Name:         SNAPSHOT_CREATED,
		Type:         resource.SearchFieldTypeInt64,
		Description:  "Unix timestamp (ms) when the snapshot was created",
		Capabilities: []resource.SearchCapability{resource.SearchCapabilitySort, resource.SearchCapabilityRetrieve},
	},
}

// SnapshotBuilder registers the document builder for dashboard snapshots so the
// LIST endpoint can be served from the search index (metadata only) instead of
// reading full 15MB bodies from storage on every list.
func SnapshotBuilder() (resource.DocumentBuilderInfo, error) {
	gvr := dashv0.SnapshotResourceInfo.GroupVersionResource()
	gr := dashv0.SnapshotResourceInfo.GroupResource()
	provider := resource.NewMapProvider(
		map[schema.GroupVersionResource][]resource.SearchFieldDefinition{gvr: SnapshotSearchFields},
		map[schema.GroupResource]string{gr: gvr.Version},
	)

	return resource.DocumentBuilderInfo{
		GroupResource:        gr,
		Builder:              &SnapshotDocumentBuilder{},
		SearchFieldsHash:     provider.IndexAffectingHash(gr.Group, gr.Resource),
		SearchFieldsProvider: provider,
	}, nil
}

type SnapshotDocumentBuilder struct{}

var _ resource.DocumentBuilder = &SnapshotDocumentBuilder{}

// snapshotMetadata is the minimal shape parsed from a stored snapshot. The
// spec.dashboard body (up to ~15MB) is intentionally omitted so index-build
// never unmarshals it.
type snapshotMetadata struct {
	APIVersion string                 `json:"apiVersion"`
	Kind       string                 `json:"kind"`
	Metadata   map[string]interface{} `json:"metadata"`
	Spec       struct {
		Title       *string `json:"title"`
		Expires     *int64  `json:"expires"`
		External    *bool   `json:"external"`
		ExternalURL *string `json:"externalUrl"`
	} `json:"spec"`
}

func (b *SnapshotDocumentBuilder) BuildDocument(ctx context.Context, key *resourcepb.ResourceKey, rv int64, value []byte) (*resource.IndexableDocument, error) {
	var snap snapshotMetadata
	if err := json.Unmarshal(value, &snap); err != nil {
		return nil, err
	}

	tmp := &unstructured.Unstructured{Object: map[string]interface{}{
		"apiVersion": snap.APIVersion,
		"kind":       snap.Kind,
		"metadata":   snap.Metadata,
	}}
	obj, err := utils.MetaAccessor(tmp)
	if err != nil {
		return nil, err
	}

	title := ""
	if snap.Spec.Title != nil {
		title = *snap.Spec.Title
	}

	doc := resource.NewIndexableDocument(key, rv, obj, title)
	doc.Fields = map[string]any{}
	if snap.Spec.Expires != nil {
		doc.Fields[SNAPSHOT_EXPIRES] = *snap.Spec.Expires
	}
	if snap.Spec.External != nil {
		doc.Fields[SNAPSHOT_EXTERNAL] = *snap.Spec.External
	}
	if snap.Spec.ExternalURL != nil {
		doc.Fields[SNAPSHOT_EXTERNAL_URL] = *snap.Spec.ExternalURL
	}
	if doc.Created > 0 {
		doc.Fields[SNAPSHOT_CREATED] = doc.Created
	}
	return doc, nil
}
