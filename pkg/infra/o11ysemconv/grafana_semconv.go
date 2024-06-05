package o11ysemconv

const (
	TraceIDKey        = "traceID"
	ErrorKey          = "error"
	ErrorReasonKey    = "errorReason"
	ErrorMessageIDKey = "errorMessageID"
	OrgIDKey          = "orgID"
	UserIDKey         = "userID"
	UsernameKey       = "username"
	DashboardUIDKey   = "dasboardUID"
)

var (
	TraceID        = String(TraceIDKey)
	Error          = Any(ErrorKey)
	ErrorReason    = String(ErrorReasonKey)
	ErrorMessageID = String(ErrorMessageIDKey)
	OrgID          = Int64(OrgIDKey)
	UserID         = Int64(UserIDKey)
	Username       = String(UsernameKey, WithLogKey("unamme"))
)
