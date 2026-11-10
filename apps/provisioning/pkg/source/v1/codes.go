package sourcev1

// Group is the API group of the contract, and the audience of exchanged tokens.
const Group = "source.grafana.app"

const APIVersion = Group + "/v1"

// Error codes carried in Error.Code and in the ErrorInfo reason of a gRPC status.
const (
	CodeBadRequest       = "bad_request"
	CodeUnauthorized     = "unauthorized"
	CodeForbidden        = "forbidden"
	CodeSourceNotFound   = "source_not_found"
	CodeFileNotFound     = "file_not_found"
	CodeRevisionNotFound = "revision_not_found"
	CodeRevisionGone     = "revision_gone"
	CodeRateLimited      = "rate_limited"
	CodeNotSupported     = "not_supported"
	CodeUnavailable      = "unavailable"
)

// Change actions.
const (
	ActionCreated = "created"
	ActionUpdated = "updated"
	ActionDeleted = "deleted"
	ActionRenamed = "renamed"
)
