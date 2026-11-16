// Package resource creates a ResourceServer that handles generic storage operations.
//
// # Blob write transport
//
// Create and Update accept blob references only in resource bodies. Upload bytes
// separately through the blob store before issuing a resource write. BulkProcess
// may also upload bytes through negotiated chunk framing, never inline body data.
// The reference-only check is independent of schema validation and also applies
// to no-op updates so inline data cannot bypass the write boundary.
//
// # Error handling
//
// Unary gRPC calls, including NewLocalResourceClient, report failures through err.
// Structured errors carry ErrorResult status details. Migrated direct Go calls
// also report failures through err. Handle err before accessing the response;
// do not add legacy Error checks to status-only paths.
//
//   - HTTP/apiserver boundaries: use [StatusErrorFromGRPC](err) to preserve HTTP
//     status. Return it unwrapped to the apiserver for APIStatus recognition;
//     errhttp.Write supports wrapping via errors.As.
//   - Other Go callers: preserve err, including its gRPC status, errors.Is/As
//     chain, and cancellation semantics. This includes legacy pkg/api/response
//     handlers until their writer supports APIStatus.
//   - Classification only: use [AsErrorResult](err) or [IsConflict](err);
//     keep the original error.
//
// # Exceptions
//
// BulkProcess now returns failures as terminal status errors, but remote servers
// predating that change can still return BulkResponse.Error. The migration client
// intentionally retains [ErrorFromResponse] to handle both forms until the Bulk
// status rollout is confirmed. Do not remove this compatibility fallback based
// only on the server code having merged. Check err before accessing a potentially
// nil response. Always check a stream's terminal receive error; successful sends
// do not imply success.
//
// Still handle per-item errors (BackendReadResponse.Error, bulk rejections).
// [StatusError] converts only an ErrorResult, not an accompanying returned error.
package resource
