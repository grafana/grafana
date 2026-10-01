package kv

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strings"
	"time"

	"github.com/grafana/grafana-app-sdk/logging"
)

// MaxKVValueBytes is the maximum allowed size of a single KV value payload (64 KiB).
// Payloads exceeding this limit are rejected at Save and Batch time.
const MaxKVValueBytes = 64 * 1024

// ErrTooManyOps is returned when a batch has more than MaxBatchOps operations.
var ErrTooManyOps = errors.New("kv: too many batch ops")

// ErrInvalidKey is returned when an owner or key fails format validation.
var ErrInvalidKey = errors.New("kv: invalid owner or key")

// ErrValueTooLarge is returned when a value exceeds MaxKVValueBytes.
var ErrValueTooLarge = errors.New("kv: value exceeds MaxKVValueBytes")

// ownerPattern matches a valid owner: lowercase alphanum, dots, and hyphens.
// Examples: "usageinsights.grafana.app", "my-plugin-id"
var ownerPattern = regexp.MustCompile(`^[a-z0-9.-]+$`)

// keySegPattern matches a single key segment (the parts between slashes).
// First character must be lowercase alphanum; remaining characters may also
// include underscore. Maximum segment length is 128 characters.
var keySegPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]{0,127}$`)

// ResourceParent identifies the parent resource that owns a set of KV entries.
type ResourceParent struct {
	Group, Resource, Namespace, Name string
}

// ResourceKVItem is a single entry returned by ScanNamespace.
type ResourceKVItem struct {
	// Name is the resource's metadata.name.
	Name string
	// Owner is the owner prefix (e.g. "usageinsights.grafana.app").
	Owner string
	// Key is the key within the owner's namespace.
	Key string
	// Value is the unwrapped user JSON.
	Value []byte
}

// ResourceKVBatchOp is a single operation in a Batch call.
type ResourceKVBatchOp struct {
	Mode  BatchOpMode
	Owner string
	Key   string
	Value []byte // for Put/Create/Update
	By    string // identity stored in the envelope
}

// kvEnvelope is the stored value wrapper that preserves the user payload alongside
// audit metadata. The HTTP layer strips it so callers see only their own JSON.
type kvEnvelope struct {
	V  json.RawMessage `json:"v"`
	At int64           `json:"at"`
	By string          `json:"by"`
}

// ResourceKVStore scopes KV operations to individual resource objects.
// Every entry is stored under the key layout:
//
//	{group}/{resource}/{namespace}/{name}/{owner}/{key}
//
// The name is the sole object identity. Rows are cleared when a new object with
// the same name is created successfully, so stale data from a previous incarnation
// is never visible to the new one.
type ResourceKVStore struct {
	kv  KV
	log logging.Logger
}

// NewResourceKVStore creates a ResourceKVStore backed by the given KV.
func NewResourceKVStore(kv KV) *ResourceKVStore {
	return &ResourceKVStore{kv: kv, log: logging.DefaultLogger.With("logger", "resource-kv")}
}

// validateOwnerKey returns an error wrapping ErrInvalidKey when owner or key
// does not meet the format defined in the design:
//
//   - owner matches ^[a-z0-9.-]+$
//   - key is one or more '/' separated segments, each matching
//     ^[a-z0-9][a-z0-9_.-]{0,127}$
//   - ':' is reserved for sub-action routing and is always rejected in keys
func validateOwnerKey(owner, key string) error {
	if owner == "" {
		return fmt.Errorf("%w: owner must not be empty", ErrInvalidKey)
	}
	if key == "" {
		return fmt.Errorf("%w: key must not be empty", ErrInvalidKey)
	}
	if strings.Contains(key, ":") {
		return fmt.Errorf("%w: key must not contain ':': %q", ErrInvalidKey, key)
	}
	if !ownerPattern.MatchString(owner) {
		return fmt.Errorf("%w: owner must match ^[a-z0-9.-]+$: got %q", ErrInvalidKey, owner)
	}
	for _, seg := range strings.Split(key, "/") {
		if !keySegPattern.MatchString(seg) {
			return fmt.Errorf("%w: key segment must match ^[a-z0-9][a-z0-9_.-]{0,127}$: got %q", ErrInvalidKey, seg)
		}
	}
	return nil
}

// kvKey builds the fully-qualified store key for a single entry.
func kvKey(p ResourceParent, owner, key string) string {
	return fmt.Sprintf("%s/%s/%s/%s/%s/%s",
		p.Group, p.Resource, p.Namespace, p.Name, owner, key)
}

// kvPrefix returns the prefix covering all entries for a resource name.
// It equals the object prefix: {group}/{resource}/{namespace}/{name}/.
func kvPrefix(p ResourceParent) string {
	return kvNamePrefix(p.Group, p.Resource, p.Namespace, p.Name)
}

// kvNamePrefix returns the prefix covering all entries for a resource name.
// Used by kvPrefix and DeleteAllForName.
func kvNamePrefix(group, resource, ns, name string) string {
	return fmt.Sprintf("%s/%s/%s/%s/", group, resource, ns, name)
}

// kvNsPrefix returns the prefix covering all entries in a namespace.
// Used by ScanNamespace for building the search index.
func kvNsPrefix(group, resource, ns string) string {
	return fmt.Sprintf("%s/%s/%s/", group, resource, ns)
}

// Get returns the unwrapped user value for a key, or ErrNotFound when absent.
// The envelope metadata (UpdatedAt, UpdatedBy) is extracted for the caller.
func (s *ResourceKVStore) Get(ctx context.Context, p ResourceParent, owner, key string) (value []byte, updatedAt int64, updatedBy string, err error) {
	rc, err := s.kv.Get(ctx, ResourceKVSection, kvKey(p, owner, key))
	if err != nil {
		return nil, 0, "", err
	}
	defer func() { _ = rc.Close() }()

	raw, err := io.ReadAll(rc)
	if err != nil {
		return nil, 0, "", fmt.Errorf("reading kv value: %w", err)
	}
	return unwrapEnvelope(raw)
}

// Keys returns all keys stored under the parent's name prefix, stripped of the
// group/resource/ns/name/ prefix so callers receive bare "owner/key" paths.
func (s *ResourceKVStore) Keys(ctx context.Context, p ResourceParent, opts ListOptions) ([]string, error) {
	prefix := kvPrefix(p)
	opts.StartKey = prefix
	opts.EndKey = PrefixRangeEnd(prefix)

	var keys []string
	for k, err := range s.kv.Keys(ctx, ResourceKVSection, opts) {
		if err != nil {
			return nil, fmt.Errorf("iterating kv keys: %w", err)
		}
		keys = append(keys, strings.TrimPrefix(k, prefix))
	}
	return keys, nil
}

// KeysByOwner returns keys under the given owner prefix for a parent, issuing a
// narrowed server-side scan. The returned strings are bare key names without the
// group/resource/ns/name/owner/ prefix.
func (s *ResourceKVStore) KeysByOwner(ctx context.Context, p ResourceParent, owner string) ([]string, error) {
	ownerPrefix := kvPrefix(p) + owner + "/"
	opts := ListOptions{
		StartKey: ownerPrefix,
		EndKey:   PrefixRangeEnd(ownerPrefix),
	}

	var keys []string
	for k, err := range s.kv.Keys(ctx, ResourceKVSection, opts) {
		if err != nil {
			return nil, fmt.Errorf("iterating kv keys for owner %q: %w", owner, err)
		}
		keys = append(keys, strings.TrimPrefix(k, ownerPrefix))
	}
	return keys, nil
}

// Save upserts the given user JSON value with an audit envelope (timestamp + identity).
// Returns ErrInvalidKey if the owner or key is malformed.
// Returns ErrValueTooLarge if the value exceeds MaxKVValueBytes.
func (s *ResourceKVStore) Save(ctx context.Context, p ResourceParent, owner, key string, value []byte, by string) error {
	if err := validateOwnerKey(owner, key); err != nil {
		return err
	}
	if len(value) > MaxKVValueBytes {
		return fmt.Errorf("%w: size %d", ErrValueTooLarge, len(value))
	}

	env, err := wrapEnvelope(value, time.Now().Unix(), by)
	if err != nil {
		return err
	}

	wc, err := s.kv.Save(ctx, ResourceKVSection, kvKey(p, owner, key))
	if err != nil {
		return fmt.Errorf("opening kv writer: %w", err)
	}
	if _, err := wc.Write(env); err != nil {
		_ = wc.Close()
		return fmt.Errorf("writing kv value: %w", err)
	}
	return wc.Close()
}

// Delete removes a key. Idempotent: no error is returned when the key is absent.
func (s *ResourceKVStore) Delete(ctx context.Context, p ResourceParent, owner, key string) error {
	if err := validateOwnerKey(owner, key); err != nil {
		return err
	}
	return s.kv.Delete(ctx, ResourceKVSection, kvKey(p, owner, key))
}

// Batch executes multiple operations atomically. Each write operation is validated
// and size-checked before being forwarded to the underlying store.
//
// Returns ErrInvalidKey for malformed owner/key in any op.
// Returns ErrValueTooLarge if any write op value exceeds MaxKVValueBytes.
// Returns a *BatchError (wrapping ErrKeyAlreadyExists or ErrNotFound) for
// create/update constraint violations, matching the underlying KV semantics.
// Returns an error when len(ops) > MaxBatchOps.
func (s *ResourceKVStore) Batch(ctx context.Context, p ResourceParent, ops []ResourceKVBatchOp) error {
	if len(ops) > MaxBatchOps {
		return fmt.Errorf("%w: %d > %d", ErrTooManyOps, len(ops), MaxBatchOps)
	}

	kvOps := make([]BatchOp, 0, len(ops))
	for i, op := range ops {
		if err := validateOwnerKey(op.Owner, op.Key); err != nil {
			return fmt.Errorf("batch op %d: %w", i, err)
		}
		if op.Mode != BatchOpDelete {
			if len(op.Value) > MaxKVValueBytes {
				return fmt.Errorf("batch op %d: %w: size %d", i, ErrValueTooLarge, len(op.Value))
			}
		}

		kop := BatchOp{
			Key:  kvKey(p, op.Owner, op.Key),
			Mode: op.Mode,
		}
		if op.Mode != BatchOpDelete {
			env, err := wrapEnvelope(op.Value, time.Now().Unix(), op.By)
			if err != nil {
				return fmt.Errorf("batch op %d: wrapping envelope: %w", i, err)
			}
			kop.Value = env
		}
		kvOps = append(kvOps, kop)
	}
	return s.kv.Batch(ctx, ResourceKVSection, kvOps)
}

// DeleteAllForName removes all KV entries for a resource name by scanning the
// name prefix and batch-deleting in chunks. This is both the async cleanup
// path called after a delete (soft or hard) and the synchronous clear run after
// a successful create, so a restored or re-created object always starts empty.
func (s *ResourceKVStore) DeleteAllForName(ctx context.Context, group, resource, ns, name string) error {
	prefix := kvNamePrefix(group, resource, ns, name)
	opts := ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}

	const chunkSize = 100
	var chunk []string

	flush := func() error {
		if len(chunk) == 0 {
			return nil
		}
		if err := s.kv.BatchDelete(ctx, ResourceKVSection, chunk); err != nil {
			return fmt.Errorf("batch deleting kv keys: %w", err)
		}
		chunk = chunk[:0]
		return nil
	}

	for k, err := range s.kv.Keys(ctx, ResourceKVSection, opts) {
		if err != nil {
			return fmt.Errorf("iterating kv keys for delete: %w", err)
		}
		chunk = append(chunk, k)
		if len(chunk) >= chunkSize {
			if err := flush(); err != nil {
				return err
			}
		}
	}
	return flush()
}

// ScanNamespace returns all KV entries for the given (group, resource, ns) triple
// as ResourceKVItems with name parsed from the key path. The caller can
// match items against live objects by name before applying them.
func (s *ResourceKVStore) ScanNamespace(ctx context.Context, group, resource, ns string) ([]ResourceKVItem, error) {
	prefix := kvNsPrefix(group, resource, ns)
	opts := ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}

	var keys []string
	for k, err := range s.kv.Keys(ctx, ResourceKVSection, opts) {
		if err != nil {
			return nil, fmt.Errorf("scanning namespace keys: %w", err)
		}
		keys = append(keys, k)
	}
	if len(keys) == 0 {
		return nil, nil
	}

	// SqlKV turns BatchGet into a single IN clause, so chunk it to stay well
	// below SQLite's bound-parameter limit.
	const batchGetChunk = 500
	var items []ResourceKVItem
	for start := 0; start < len(keys); start += batchGetChunk {
		end := min(start+batchGetChunk, len(keys))
		for kv, err := range s.kv.BatchGet(ctx, ResourceKVSection, keys[start:end]) {
			if err != nil {
				return nil, fmt.Errorf("batch-fetching scan values: %w", err)
			}
			raw, readErr := io.ReadAll(kv.Value)
			_ = kv.Value.Close()
			if readErr != nil {
				s.log.Warn("skipping unreadable resource kv entry", "key", kv.Key, "error", readErr)
				continue
			}
			value, _, _, unwrapErr := unwrapEnvelope(raw)
			if unwrapErr != nil {
				s.log.Warn("skipping resource kv entry with invalid envelope", "key", kv.Key, "error", unwrapErr)
				continue
			}
			item, parseErr := parseKVKey(kv.Key, value)
			if parseErr != nil {
				s.log.Warn("skipping resource kv entry with unparseable key", "key", kv.Key, "error", parseErr)
				continue
			}
			items = append(items, item)
		}
	}
	return items, nil
}

// ScanNamespaceOwnerKey returns every entry under (owner, key) for every
// resource of group/resource in ns. Entries under other owners or keys are
// never returned.
//
// Unlike ScanNamespace, only the keys matching (owner, key) are fetched:
// this walks the same namespace prefix, but filters the key strings before
// BatchGet, so only the declared documents' values are read. Key listing is
// still O(keys in the namespace); only the value fetch is narrowed.
func (s *ResourceKVStore) ScanNamespaceOwnerKey(ctx context.Context, group, resource, ns, owner, key string) ([]ResourceKVItem, error) {
	prefix := kvNsPrefix(group, resource, ns)
	opts := ListOptions{
		StartKey: prefix,
		EndKey:   PrefixRangeEnd(prefix),
	}

	// Security: a plain suffix match on "/{owner}/{key}" is not
	// enough. Since key may itself contain '/', another owner's key can be
	// crafted (or another resource's deeper key can happen) to end in
	// exactly that suffix without owner and key actually matching -- e.g.
	// owner="evil", key="usageinsights.grafana.app/stats" produces a raw
	// key ending in "/usageinsights.grafana.app/stats" too. Each candidate
	// key is instead split into its own name/owner/key segments -- owner
	// is validated elsewhere to never contain '/', so SplitN(_, "/", 3)
	// on the part after the namespace prefix always isolates it correctly
	// -- and only an exact owner and exact (possibly multi-segment) key
	// match is kept.
	var keys []string
	for k, err := range s.kv.Keys(ctx, ResourceKVSection, opts) {
		if err != nil {
			return nil, fmt.Errorf("scanning namespace keys: %w", err)
		}
		remainder := strings.TrimPrefix(k, prefix)
		parts := strings.SplitN(remainder, "/", 3)
		if len(parts) != 3 {
			continue
		}
		if parts[1] != owner || parts[2] != key {
			continue
		}
		keys = append(keys, k)
	}
	if len(keys) == 0 {
		return nil, nil
	}

	// SqlKV turns BatchGet into a single IN clause, so chunk it to stay well
	// below SQLite's bound-parameter limit.
	const batchGetChunk = 500
	var items []ResourceKVItem
	for start := 0; start < len(keys); start += batchGetChunk {
		end := min(start+batchGetChunk, len(keys))
		for kv, err := range s.kv.BatchGet(ctx, ResourceKVSection, keys[start:end]) {
			if err != nil {
				return nil, fmt.Errorf("batch-fetching scan values: %w", err)
			}
			raw, readErr := io.ReadAll(kv.Value)
			_ = kv.Value.Close()
			if readErr != nil {
				s.log.Warn("skipping unreadable resource kv entry", "key", kv.Key, "error", readErr)
				continue
			}
			value, _, _, unwrapErr := unwrapEnvelope(raw)
			if unwrapErr != nil {
				s.log.Warn("skipping resource kv entry with invalid envelope", "key", kv.Key, "error", unwrapErr)
				continue
			}
			item, parseErr := parseKVKey(kv.Key, value)
			if parseErr != nil {
				s.log.Warn("skipping resource kv entry with unparseable key", "key", kv.Key, "error", parseErr)
				continue
			}
			items = append(items, item)
		}
	}
	return items, nil
}

func wrapEnvelope(value []byte, at int64, by string) ([]byte, error) {
	env := kvEnvelope{
		V:  json.RawMessage(value),
		At: at,
		By: by,
	}
	return json.Marshal(env)
}

func unwrapEnvelope(raw []byte) (value []byte, updatedAt int64, updatedBy string, err error) {
	var env kvEnvelope
	if err := json.Unmarshal(raw, &env); err != nil {
		return nil, 0, "", fmt.Errorf("unwrapping kv envelope: %w", err)
	}
	return []byte(env.V), env.At, env.By, nil
}

// parseKVKey parses a bare key (without the section prefix) of the form
// {group}/{resource}/{ns}/{name}/{owner}/{key} and returns a ResourceKVItem.
func parseKVKey(bareKey string, value []byte) (ResourceKVItem, error) {
	// Minimum 6 parts: group/resource/ns/name/owner/key
	parts := strings.SplitN(bareKey, "/", 6)
	if len(parts) < 6 {
		return ResourceKVItem{}, fmt.Errorf("malformed kv key: %q", bareKey)
	}
	return ResourceKVItem{
		Name:  parts[3],
		Owner: parts[4],
		Key:   parts[5],
		Value: value,
	}, nil
}
