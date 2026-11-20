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
// BulkProcess reports failures through the terminal receive error. Check err
// before accessing a potentially nil response. Always check a stream's terminal
// receive error; successful sends do not imply success.
//
// [StatusError] converts only an ErrorResult, not an accompanying returned error.
//
// # Per-item errors
//
// Still handle per-item errors (BackendReadResponse.Error, bulk rejections).
package resource
