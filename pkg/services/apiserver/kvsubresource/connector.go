// Package kvsubresource provides a generic k8s rest.Connecter for the KV
// accessory-data subresource.  It is designed to be mounted on any
// group/resource that declares a kv block in its manifest; C5b performs the
// mounting.  The feature flag gate is the mount itself — there is no per-request
// flag check here.
package kvsubresource

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	app "github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	kvpkg "github.com/grafana/grafana/pkg/storage/unified/resource/kv"
	resourcepb "github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// kvBatchOpJSONOverhead is the per-operation JSON envelope overhead (field
// names, delimiters, quotes, etc.) used to bound how much data handleBatch
// will read before rejecting with 413.
const kvBatchOpJSONOverhead = 512

const (
	kvActionWrite = "kv:write"
	kvScopePrefix = "kv:owner:"
)

// KVConnector implements rest.Connecter for both the "kv" and "kv:batch"
// subresources.  A single instance handles both subresource paths; the caller
// registers it under both "{resource}/kv" and "{resource}/kv:batch".
//
// Subresource routing:
//
//	GET  /kv              → list keys; ?owner=<owner> narrows to that owner
//	GET  /kv/{owner}/{key...}   → get a value
//	PUT  /kv/{owner}/{key...}   → save a value  (kv:write required)
//	DELETE /kv/{owner}/{key...} → delete a value (kv:write required)
//	POST /kv:batch              → batch operations (kv:write per op)
//
// Write responses (PUT, DELETE, POST batch): 204 No Content, no body.
// This choice is applied uniformly to all mutating operations so callers have a
// single contract: success = 2xx, mutations = 204.
type KVConnector struct {
	gr            schema.GroupResource
	getter        rest.Getter
	kvClient      resourcepb.ResourceKVClient
	access        accesscontrol.AccessControl
	maxValueBytes int // effective per-kind cap (≤ kvpkg.MaxKVValueBytes)
	logger        log.Logger
}

// NewKVConnector creates a KVConnector for the given parent GroupResource.
//
// kvLimits carries optional per-kind overrides from the kind's manifest
// declaration (app.ManifestVersionKindKV).  The effective max-value-bytes is:
//
//	min(kvLimits.MaxValueBytes if >0, kvpkg.MaxKVValueBytes)
//
// Passing nil for kvLimits uses the platform default (64 KiB).
func NewKVConnector(
	gr schema.GroupResource,
	getter rest.Getter,
	kvClient resourcepb.ResourceKVClient,
	access accesscontrol.AccessControl,
	kvLimits *app.ManifestVersionKindKV,
) *KVConnector {
	maxBytes := kvpkg.MaxKVValueBytes
	if kvLimits != nil && kvLimits.MaxValueBytes > 0 && kvLimits.MaxValueBytes < maxBytes {
		maxBytes = kvLimits.MaxValueBytes
	}
	return &KVConnector{
		gr:            gr,
		getter:        getter,
		kvClient:      kvClient,
		access:        access,
		maxValueBytes: maxBytes,
		logger:        log.New("kvsubresource"),
	}
}

var (
	_ rest.Connecter       = (*KVConnector)(nil)
	_ rest.StorageMetadata = (*KVConnector)(nil)
)

// New returns a KVResponse, which is registered in this package's scheme.
// OpenAPI model generation requires a type registered under the correct
// group-version; KVResponse is registered by C5b via AddToScheme.
func (c *KVConnector) New() runtime.Object {
	return &KVResponse{}
}

// Destroy is a no-op; the connector holds no owned resources.
func (c *KVConnector) Destroy() {}

// ConnectMethods lists every HTTP verb the KV connector handles.
func (c *KVConnector) ConnectMethods() []string {
	return []string{http.MethodGet, http.MethodPut, http.MethodDelete, http.MethodPost}
}

// NewConnectOptions signals that this connector accepts a trailing subpath
// (owner/key segments).  The k8s apiserver populates RequestInfo.Parts[3:]
// with the extra path segments when the bool return is true.  The options
// object is unused (nil).
//
// Sub-path derivation reference: pkg/registry/apis/datasource/sub_proxy.go
// and sub_access.go use the same (nil, true, "") pattern and read extra
// segments from RequestInfo.Parts[3:] in their Connect handlers.
func (c *KVConnector) NewConnectOptions() (runtime.Object, bool, string) {
	return nil, true, ""
}

// ProducesMIMETypes returns nil; the connector sets Content-Type per-response.
func (c *KVConnector) ProducesMIMETypes(_ string) []string { return nil }

// ProducesObject returns a KVResponse for OpenAPI schema registration.
func (c *KVConnector) ProducesObject(_ string) interface{} { return &KVResponse{} }

// Connect returns an http.Handler that routes KV operations.
//
// The parent resource is read with the caller's context so that the existing
// k8s RBAC check on the parent (e.g. dashboards:get) is enforced naturally
// without any extra authz call here.
func (c *KVConnector) Connect(ctx context.Context, name string, _ runtime.Object, _ rest.Responder) (http.Handler, error) {
	rawObj, err := c.getter.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, err
	}
	obj, err := utils.MetaAccessor(rawObj)
	if err != nil {
		return nil, err
	}

	// Build the ResourceKey once per connection.
	// Layout: {group}/{resource}/{ns}/{name}/{owner}/{key}.
	rk := &resourcepb.ResourceKey{
		Group:     c.gr.Group,
		Resource:  c.gr.Resource,
		Namespace: obj.GetNamespace(),
		Name:      obj.GetName(),
	}

	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		// Sub-path derivation: k8s populates RequestInfo.Parts for connecters:
		//   Parts[0] = resource (e.g. "dashboards")
		//   Parts[1] = name     (e.g. "my-dash")
		//   Parts[2] = subresource ("kv" or "kv:batch")
		//   Parts[3:] = extra path segments (owner, key, …)
		// This matches the pattern used by sub_proxy.go and sub_access.go in
		// pkg/registry/apis/datasource, which return (nil, true, "") from
		// NewConnectOptions and read Parts[3:] in their handlers.
		reqInfo, _ := k8srequest.RequestInfoFrom(req.Context())

		// "kv:batch" is registered as a separate subresource; POST is the only
		// method that makes sense here.
		if reqInfo != nil && reqInfo.Subresource == "kv:batch" {
			if req.Method != http.MethodPost {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
				return
			}
			c.handleBatch(w, req, rk)
			return
		}

		// "kv" subresource: Parts[3:] carry the owner/key path.
		var subpath string
		if reqInfo != nil && len(reqInfo.Parts) > 3 {
			subpath = strings.Join(reqInfo.Parts[3:], "/")
		}

		switch req.Method {
		case http.MethodGet:
			if subpath == "" {
				c.handleKeys(w, req, rk)
			} else {
				c.handleGet(w, req, rk, subpath)
			}
		case http.MethodPut:
			c.handleSave(w, req, rk, subpath)
		case http.MethodDelete:
			c.handleDelete(w, req, rk, subpath)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	}), nil
}

// kvListResponse is the JSON envelope returned by list operations.
// The keys field is never null (empty list marshals as []).
type kvListResponse struct {
	Keys []string `json:"keys"`
}

func (c *KVConnector) handleKeys(w http.ResponseWriter, req *http.Request, rk *resourcepb.ResourceKey) {
	owner := req.URL.Query().Get("owner")
	resp, err := c.kvClient.Keys(req.Context(), &resourcepb.ResourceKVKeysRequest{
		Parent: rk,
		Owner:  owner,
	})
	if err != nil {
		c.writeGRPCError(w, err)
		return
	}
	keys := resp.GetKeys()
	if keys == nil {
		keys = []string{}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(kvListResponse{Keys: keys})
}

func (c *KVConnector) handleGet(w http.ResponseWriter, req *http.Request, rk *resourcepb.ResourceKey, subpath string) {
	owner, key, err := splitOwnerKey(subpath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	resp, err := c.kvClient.Get(req.Context(), &resourcepb.ResourceKVGetRequest{
		Parent: rk,
		Owner:  owner,
		Key:    key,
	})
	if err != nil {
		c.writeGRPCError(w, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Grafana-KV-Updated-At", strconv.FormatInt(resp.GetUpdatedAt(), 10))
	w.Header().Set("X-Grafana-KV-Updated-By", resp.GetUpdatedBy())
	_, _ = w.Write(resp.GetValue())
}

func (c *KVConnector) handleSave(w http.ResponseWriter, req *http.Request, rk *resourcepb.ResourceKey, subpath string) {
	ctx := req.Context()
	owner, key, err := splitOwnerKey(subpath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := c.checkWriteAuthz(ctx, w, owner); err != nil {
		return
	}
	// Cap reads at maxValueBytes+1: if we read that many bytes the body is
	// oversized and we can reject immediately without consuming more data.
	lr := io.LimitReader(req.Body, int64(c.maxValueBytes)+1)
	body, err := io.ReadAll(lr)
	if err != nil {
		http.Error(w, "reading request body", http.StatusBadRequest)
		return
	}
	if len(body) > c.maxValueBytes {
		http.Error(w, fmt.Sprintf("value too large: %d bytes (limit %d)", len(body), c.maxValueBytes), http.StatusRequestEntityTooLarge)
		return
	}
	if !json.Valid(body) {
		http.Error(w, "request body must be valid JSON", http.StatusBadRequest)
		return
	}
	by := requesterUID(ctx)
	if _, err := c.kvClient.Save(ctx, &resourcepb.ResourceKVSaveRequest{
		Parent: rk,
		Owner:  owner,
		Key:    key,
		Value:  body,
		By:     by,
	}); err != nil {
		c.writeGRPCError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (c *KVConnector) handleDelete(w http.ResponseWriter, req *http.Request, rk *resourcepb.ResourceKey, subpath string) {
	ctx := req.Context()
	owner, key, err := splitOwnerKey(subpath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if err := c.checkWriteAuthz(ctx, w, owner); err != nil {
		return
	}
	if _, err := c.kvClient.Delete(ctx, &resourcepb.ResourceKVDeleteRequest{
		Parent: rk,
		Owner:  owner,
		Key:    key,
	}); err != nil {
		c.writeGRPCError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// kvBatchRequest is the JSON body for POST kv:batch.
type kvBatchRequest struct {
	Ops []kvBatchOpJSON `json:"ops"`
}

type kvBatchOpJSON struct {
	Mode  string          `json:"mode"`
	Owner string          `json:"owner"`
	Key   string          `json:"key"`
	Value json.RawMessage `json:"value,omitempty"`
}

func (c *KVConnector) handleBatch(w http.ResponseWriter, req *http.Request, rk *resourcepb.ResourceKey) {
	ctx := req.Context()

	// Cap how much data we read: MaxBatchOps × (per-value cap + JSON envelope overhead)
	// plus a small allowance for the outer JSON wrapper.
	batchBodyLimit := int64(kvpkg.MaxBatchOps)*int64(c.maxValueBytes+kvBatchOpJSONOverhead) + 128
	lr := io.LimitReader(req.Body, batchBodyLimit+1)
	raw, err := io.ReadAll(lr)
	if err != nil {
		http.Error(w, "reading batch body", http.StatusBadRequest)
		return
	}
	if int64(len(raw)) > batchBodyLimit {
		http.Error(w, fmt.Sprintf("batch body too large (limit %d bytes)", batchBodyLimit), http.StatusRequestEntityTooLarge)
		return
	}

	var batchReq kvBatchRequest
	if err := json.Unmarshal(raw, &batchReq); err != nil {
		http.Error(w, fmt.Sprintf("decode batch body: %v", err), http.StatusBadRequest)
		return
	}

	// Reject oversized batches cheaply before any per-op work.
	if len(batchReq.Ops) > kvpkg.MaxBatchOps {
		http.Error(w, fmt.Sprintf("too many operations: %d (limit %d)", len(batchReq.Ops), kvpkg.MaxBatchOps), http.StatusBadRequest)
		return
	}

	by := requesterUID(ctx)

	ops := make([]*resourcepb.ResourceKVBatchOp, 0, len(batchReq.Ops))
	for _, op := range batchReq.Ops {
		mode, err := parseProtoMode(op.Mode)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		// All batch operations are mutations (there is no batch-read mode);
		// each requires kv:write on its owner scope.
		if err := c.checkWriteAuthz(ctx, w, op.Owner); err != nil {
			return
		}

		// Reject over-size values before issuing the gRPC call.
		if len(op.Value) > c.maxValueBytes {
			http.Error(w, fmt.Sprintf("value too large for op %s/%s: %d bytes (limit %d)", op.Owner, op.Key, len(op.Value), c.maxValueBytes), http.StatusRequestEntityTooLarge)
			return
		}

		ops = append(ops, &resourcepb.ResourceKVBatchOp{
			Mode:  mode,
			Owner: op.Owner,
			Key:   op.Key,
			Value: op.Value,
			By:    by,
		})
	}

	if _, err := c.kvClient.Batch(ctx, &resourcepb.ResourceKVBatchRequest{
		Parent: rk,
		Ops:    ops,
	}); err != nil {
		c.writeGRPCError(w, err)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// checkWriteAuthz enforces kv:write on kv:owner:{owner}.
// On failure it writes the HTTP error response and returns a non-nil sentinel.
func (c *KVConnector) checkWriteAuthz(ctx context.Context, w http.ResponseWriter, owner string) error {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		http.Error(w, "no identity", http.StatusUnauthorized)
		return err
	}
	ok, err := c.access.Evaluate(ctx, requester, accesscontrol.EvalPermission(kvActionWrite, kvScopePrefix+owner))
	if err != nil {
		c.logger.Error("KV authz evaluation failed", "owner", owner, "err", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return err
	}
	if !ok {
		http.Error(w, "not authorized to write to this KV owner", http.StatusForbidden)
		return fmt.Errorf("forbidden")
	}
	return nil
}

// requesterUID returns the type:uid of the requester in ctx (e.g. "user:abc123")
// for use as the `by` audit field on writes.  Returns empty string if no
// identity is present; write handlers call this only after checkWriteAuthz
// succeeds so the identity is guaranteed to exist.
func requesterUID(ctx context.Context) string {
	requester, err := identity.GetRequester(ctx)
	if err != nil || requester == nil {
		return ""
	}
	return requester.GetUID()
}

// splitOwnerKey splits "owner/key/with/slashes" → ("owner", "key/with/slashes").
// Returns an error when the subpath does not contain a slash or the owner segment
// is empty.
func splitOwnerKey(subpath string) (owner, key string, err error) {
	idx := strings.Index(subpath, "/")
	if idx <= 0 {
		return "", "", fmt.Errorf("subpath must be owner/key, got %q", subpath)
	}
	return subpath[:idx], subpath[idx+1:], nil
}

// parseProtoMode converts the string mode from the batch JSON body to the
// proto enum value.  An empty or unrecognised mode returns an error so the
// caller can respond 400 rather than silently defaulting to PUT.
func parseProtoMode(mode string) (resourcepb.ResourceKVBatchOp_Mode, error) {
	switch strings.ToUpper(mode) {
	case "PUT":
		return resourcepb.ResourceKVBatchOp_PUT, nil
	case "CREATE":
		return resourcepb.ResourceKVBatchOp_CREATE, nil
	case "UPDATE":
		return resourcepb.ResourceKVBatchOp_UPDATE, nil
	case "DELETE":
		return resourcepb.ResourceKVBatchOp_DELETE, nil
	default:
		return 0, fmt.Errorf("unknown batch operation mode %q (expected PUT, CREATE, UPDATE or DELETE)", mode)
	}
}

// writeGRPCError maps a gRPC status code to the appropriate HTTP status and
// writes the error response.  For 4xx responses the gRPC message is surfaced
// directly because it is a caller-contract violation; for 5xx the error is
// logged and a generic message is returned to avoid leaking internal details.
//
//	codes.InvalidArgument   → 400
//	codes.NotFound          → 404
//	codes.AlreadyExists     → 409
//	codes.PermissionDenied  → 403
//	codes.Unauthenticated   → 401
//	codes.Unimplemented     → 501
//	others                  → 500
func (c *KVConnector) writeGRPCError(w http.ResponseWriter, err error) {
	st := status.Convert(err)
	msg := st.Message()
	switch st.Code() {
	case codes.InvalidArgument:
		http.Error(w, msg, http.StatusBadRequest)
	case codes.NotFound:
		http.Error(w, msg, http.StatusNotFound)
	case codes.AlreadyExists:
		http.Error(w, msg, http.StatusConflict)
	case codes.PermissionDenied:
		http.Error(w, msg, http.StatusForbidden)
	case codes.Unauthenticated:
		http.Error(w, msg, http.StatusUnauthorized)
	case codes.Unimplemented:
		http.Error(w, msg, http.StatusNotImplemented)
	default:
		c.logger.Error("KV subresource gRPC error", "code", st.Code(), "err", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}
}
