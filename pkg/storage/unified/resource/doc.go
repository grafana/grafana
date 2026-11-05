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
// Unified storage calls can report failure through a response-embedded ErrorResult
// or a transport error. Choose the helper based on what the caller does next:
//
//   - Writing an HTTP response (e.g. with errhttp.Write or responder.Error)
//     or returning an error to the apiserver (including REST storage methods and
//     validation hooks): use [StatusErrorFromResponse] so the final response has
//     the intended HTTP status. Return it unwrapped on the apiserver path so it
//     can recognize APIStatus. errhttp.Write supports wrapped errors via errors.As.
//     If the RPC has no Error field, or you only have the returned error, use
//     [StatusErrorFromGRPC](err) instead of StatusErrorFromResponse(nil, err).
//   - Returning to another Go caller outside that response boundary: use
//     [ErrorFromResponse] to resolve the two failure signals into one error.
//     It gives the transport error precedence and
//     leaves it intact, preserving the gRPC status, errors.Is/As chain, and
//     cancellation semantics; otherwise it converts the response-embedded error.
//   - Only classifying an error (for example, conflict, not-found, or status code):
//     inspect [AsErrorResult](err) or use [IsConflict](err). Do not replace the
//     original error with a converted error just to classify it.
//
// Legacy pkg/api/response handlers count as returning to another Go caller until
// their response writer understands APIStatus; use ErrorFromResponse there.
//
// StatusError converts an ErrorResult to a Kubernetes status error, but does not
// resolve a transport error alongside it. Prefer the response helpers above when
// handling the outcome of a storage call.
package resource
