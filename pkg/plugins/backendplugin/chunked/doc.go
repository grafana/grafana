// Package chunked transports datasource query results as text/jsonl.
//
// Each frame event has a refId, an optional frameId, and JSON frame data. The
// first event for a frame includes schema and data. Subsequent events for the
// same nonempty (refId, frameId) append rows and omit the schema, following the
// SDK ChunkedDataWriter contract. Different IDs identify separate frames. Frames
// without frameId are independent and must each include schema and data. Per-query errors use the same refId and may
// include error, errorSource, and an HTTP-style numeric status. An omitted status
// does not reset a previously supplied status.
//
// A successful query ends with {"type":"complete"}. A stream failure after
// output starts ends with {"type":"error","error":"message"} instead. Both
// records are stream-wide and have no refId. EOF without explicit completion is
// an error, including a clean HTTP close between otherwise valid events. A
// completed stream may still contain per-query errors; completion only confirms
// that the transport delivered the entire query response.
//
// Writers and readers supporting these records must be deployed before enabling
// chunked transport for a datasource type. Readers do not fall back or replay a
// query when decoding fails. Collecting a stream retains the decoded result in
// memory and does not reduce its final size.
package chunked
