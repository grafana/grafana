// Package resource creates a ResourceServer that handles generic storage operations.
//
// # Error handling
//
// Unified storage calls can report failure through a response-embedded ErrorResult
// or a transport error. Choose the helper based on what the caller does next:
//
//   - About to write a response with errhttp.Write or responder.Error: use
//     [StatusErrorFromResponse] and pass or return its error unwrapped so the
//     writer can recognize APIStatus and use the intended HTTP status.
//   - Returning to another Go caller: use [ErrorFromResponse] to resolve the two
//     failure signals into one error. It gives the transport error precedence and
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
