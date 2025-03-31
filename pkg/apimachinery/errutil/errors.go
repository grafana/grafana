package errutil

import (
	"encoding/json"
	"errors"
	"fmt"

	errorsK8s "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Base represents the static information about a specific error.
// Always use [NewBase] to create new instances of Base.
type Base struct {
	// Because Base is typically instantiated as a package or global
	// variable, having private members reduces the probability of a
	// bug messing with the error base.
	reason        StatusReason
	messageID     string
	publicMessage string
	logLevel      LogLevel
	source        Source
}

// NewBase initializes a [Base] that is used to construct [Error].
// The reason is used to determine the status code that should be
// returned for the error, and the msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	login.failedAuthentication
//	dashboards.validationError
//	dashboards.uidAlreadyExists
func NewBase(reason StatusReason, msgID string, opts ...BaseOpt) Base {
	b := Base{
		reason:    reason,
		messageID: msgID,
		logLevel:  reason.Status().LogLevel(),
		source:    SourceServer,
	}

	for _, opt := range opts {
		b = opt(b)
	}

	return b
}

// NotFound initializes a new [Base] error with reason StatusNotFound
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	folder.notFound
//	plugin.notRegistered
func NotFound(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusNotFound, msgID, opts...)
}

// UnprocessableContent initializes a new [Base] error with reason StatusUnprocessableEntity
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	plugin.checksumMismatch
func UnprocessableEntity(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusUnprocessableEntity, msgID, opts...)
}

// UnsupportedMediaType initializes a new [Base] error with reason StatusUnsupportedMediaType
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	plugin.unsupportedMediaType
func UnsupportedMediaType(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusUnsupportedMediaType, msgID, opts...)
}

// Conflict initializes a new [Base] error with reason StatusConflict
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	folder.alreadyExists
func Conflict(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusConflict, msgID, opts...)
}

// BadRequest initializes a new [Base] error with reason StatusBadRequest
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	query.invalidDatasourceId
//	sse.dataQueryError
func BadRequest(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusBadRequest, msgID, opts...)
}

// ValidationFailed initializes a new [Base] error with reason StatusValidationFailed
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	datasource.nameInvalid
//	datasource.urlInvalid
//	serviceaccounts.errInvalidInput
func ValidationFailed(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusValidationFailed, msgID, opts...)
}

// Internal initializes a new [Base] error with reason StatusInternal
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	sqleng.connectionError
//	plugin.requestFailureError
func Internal(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusInternal, msgID, opts...)
}

// Timeout initializes a new [Base] error with reason StatusTimeout.
//
//	area.timeout
func Timeout(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusTimeout, msgID, opts...)
}

// Unauthorized initializes a new [Base] error with reason StatusUnauthorized
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	auth.unauthorized
func Unauthorized(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusUnauthorized, msgID, opts...)
}

// Forbidden initializes a new [Base] error with reason StatusForbidden
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	quota.disabled
//	user.sync.forbidden
func Forbidden(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusForbidden, msgID, opts...)
}

// TooManyRequests initializes a new [Base] error with reason StatusTooManyRequests
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	area.tooManyRequests
func TooManyRequests(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusTooManyRequests, msgID, opts...)
}

// ClientClosedRequest initializes a new [Base] error with reason StatusClientClosedRequest
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	plugin.requestCanceled
func ClientClosedRequest(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusClientClosedRequest, msgID, opts...)
}

// NotImplemented initializes a new [Base] error with reason StatusNotImplemented
// that is used to construct [Error]. The msgID is passed to the caller
// to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	plugin.notImplemented
//	auth.identity.unsupported
func NotImplemented(msgID string, opts ...BaseOpt) Base {
	return NewBase(StatusNotImplemented, msgID, opts...)
}

// BadGateway initializes a new [Base] error with reason StatusBadGateway
// and source SourceDownstream that is used to construct [Error]. The msgID
// is passed to the caller to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	area.downstreamError
func BadGateway(msgID string, opts ...BaseOpt) Base {
	newOpts := []BaseOpt{WithDownstream()}
	newOpts = append(newOpts, opts...)
	return NewBase(StatusBadGateway, msgID, newOpts...)
}

// GatewayTimeout initializes a new [Base] error with reason StatusGatewayTimeout
// and source SourceDownstream that is used to construct [Error]. The msgID
// is passed to the caller to serve as the base for user facing error messages.
//
// msgID should be structured as component.errorBrief, for example
//
//	area.downstreamTimeout
func GatewayTimeout(msgID string, opts ...BaseOpt) Base {
	newOpts := []BaseOpt{WithDownstream()}
	newOpts = append(newOpts, opts...)
	return NewBase(StatusGatewayTimeout, msgID, newOpts...)
}

type BaseOpt func(Base) Base

// WithLogLevel sets a custom log level for all errors instantiated from
// this [Base].
//
// Used as a functional option to [NewBase].
func WithLogLevel(lvl LogLevel) BaseOpt {
	return func(b Base) Base {
		b.logLevel = lvl
		return b
	}
}

// WithPublicMessage sets the default public message that will be used
// for errors based on this [Base].
//
// Used as a functional option to [NewBase].
func WithPublicMessage(message string) BaseOpt {
	return func(b Base) Base {
		b.publicMessage = message
		return b
	}
}

// WithDownstream sets the source as SourceDownstream that will be used
// for errors based on this [Base].
//
// Used as a functional option to [NewBase].
func WithDownstream() BaseOpt {
	return func(b Base) Base {
		b.source = SourceDownstream
		return b
	}
}

// Errorf creates a new [Error] with Reason and MessageID from [Base],
// and Message and Underlying will be populated using the rules of
// [fmt.Errorf].
func (b Base) Errorf(format string, args ...any) Error {
	err := fmt.Errorf(format, args...)

	return Error{
		Reason:        b.reason,
		LogMessage:    err.Error(),
		PublicMessage: b.publicMessage,
		MessageID:     b.messageID,
		Underlying:    errors.Unwrap(err),
		LogLevel:      b.logLevel,
		Source:        b.source,
	}
}

// Error makes Base implement the error type. Relying on this is
// discouraged, as the Error type can carry additional information
// that's valuable when debugging.
func (b Base) Error() string {
	return b.Errorf("").Error()
}

func (b Base) Status() StatusReason {
	if b.reason == nil {
		return StatusUnknown
	}
	return b.reason.Status()
}

// Is validates that an [Error] has the same reason and messageID as the
// Base.
//
// Implements the interface used by [errors.Is].
func (b Base) Is(err error) bool {
	// The linter complains that it wants to use errors.As because it
	// handles unwrapping, we don't want to do that here since we want
	// to validate the equality between the two objects.
	// errors.Is handles the unwrapping, should you want it.
	//nolint:errorlint
	base, isBase := err.(Base)
	//nolint:errorlint
	gfErr, isGrafanaError := err.(Error)

	switch {
	case isGrafanaError:
		return b.reason == gfErr.Reason && b.messageID == gfErr.MessageID
	case isBase:
		return b.reason == base.reason && b.messageID == base.messageID
	default:
		return false
	}
}

// Allow errorutil errors to be returned as informative k8s errors
var _ = errorsK8s.APIStatus(&Error{})

// Error is the error type for errors within Grafana, extending
// the Go error type with Grafana specific metadata to reduce
// boilerplate error handling for status codes and internationalization
// support.
//
// Use [Base.Errorf] or [Template.Build] to construct errors:
//
//	// package-level
//	var errMonthlyQuota = NewBase(errutil.StatusTooManyRequests, "service.monthlyQuotaReached")
//	// in function
//	err := errMonthlyQuota.Errorf("user '%s' reached their monthly quota for service", userUID)
//
// or
//
//	// package-level
//	var errRateLimited = NewBase(errutil.StatusTooManyRequests, "service.backoff").MustTemplate(
//		"quota reached for user {{ .Private.user }}, rate limited until {{ .Public.time }}",
//		errutil.WithPublic("Too many requests, try again after {{ .Public.time }}"),
//	)
//	// in function
//	err := errRateLimited.Build(TemplateData{
//		Private: map[string]interface{ "user": userUID },
//		Public: map[string]interface{ "time": rateLimitUntil },
//	})
//
// Error implements Unwrap and Is to natively support Go 1.13 style
// errors as described in https://go.dev/blog/go1.13-errors .
type Error struct {
	// Reason provides the Grafana abstracted reason which can be turned
	// into an upstream status code depending on the protocol. This
	// allows us to use the same errors across HTTP, gRPC, and other
	// protocols.
	Reason StatusReason
	// A MessageID together with PublicPayload should suffice to
	// create the PublicMessage. This lets a localization aware client
	// construct messages based on structured data.
	MessageID string
	// LogMessage will be displayed in the server logs or wherever
	// [Error.Error] is called.
	LogMessage string
	// Underlying is the wrapped error returned by [Error.Unwrap].
	Underlying error
	// PublicMessage is constructed from the template uniquely
	// identified by MessageID and the values in PublicPayload (if any)
	// to provide the end-user with information that they can use to
	// resolve the issue.
	PublicMessage string
	// PublicPayload provides fields for passing structured data to
	// construct localized error messages in the client.
	PublicPayload map[string]any
	// LogLevel provides a suggested level of logging for the error.
	LogLevel LogLevel
	// Source identifies from where the error originates.
	Source Source
}

// MarshalJSON returns an error, we do not want raw [Error]s being
// marshaled into JSON.
//
// Use [Error.Public] to convert the Error into a [PublicError] which
// can safely be marshaled into JSON. This is not done automatically,
// as that conversion is lossy.
func (e Error) MarshalJSON() ([]byte, error) {
	return nil, fmt.Errorf("errutil.Error cannot be directly marshaled into JSON")
}

// Error implements the error interface.
func (e Error) Error() string {
	return fmt.Sprintf("[%s] %s", e.MessageID, e.LogMessage)
}

// When the error is rendered by an apiserver, this format is used
func (e Error) Status() metav1.Status {
	public := e.Public()
	s := metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    int32(public.StatusCode),
		Reason:  metav1.StatusReason(e.Reason.Status()), // almost true
		Message: public.Message,
	}

	// Shove the extra data into details
	if public.Extra != nil || public.MessageID != "" {
		s.Details = &metav1.StatusDetails{
			UID: types.UID(public.MessageID),
		}
		for k, v := range public.Extra {
			v, err := json.Marshal(v)
			if err != nil {
				continue
			}
			s.Details.Causes = append(s.Details.Causes, metav1.StatusCause{
				Field:   k,
				Message: string(v),
			})
		}
	}
	return s
}

// Unwrap is used by errors.As to iterate over the sequence of
// underlying errors until a matching type is found.
func (e Error) Unwrap() error {
	return e.Underlying
}

// Is checks whether an error is derived from the error passed as an
// argument.
//
// Implements the interface used by [errors.Is].
func (e Error) Is(other error) bool {
	// The linter complains that it wants to use errors.As because it
	// handles unwrapping, we don't want to do that here since we want
	// to validate the equality between the two objects.
	// errors.Is handles the unwrapping, should you want it.
	//nolint:errorlint
	o, isGrafanaError := other.(Error)
	//nolint:errorlint
	base, isBase := other.(Base)
	//nolint:errorlint
	templateErr, isTemplateErr := other.(Template)

	switch {
	case isGrafanaError:
		return o.Reason == e.Reason && o.MessageID == e.MessageID && o.Error() == e.Error()
	case isBase:
		return base.Is(e)
	case isTemplateErr:
		return templateErr.Base.Is(e)
	default:
		return false
	}
}

// PublicError is derived from Error and only contains information
// available to the end user.
type PublicError struct {
	StatusCode int            `json:"statusCode"`
	MessageID  string         `json:"messageId"`
	Message    string         `json:"message,omitempty"`
	Extra      map[string]any `json:"extra,omitempty"`
}

// Public returns a subset of the error with non-sensitive information
// that may be relayed to the caller.
func (e Error) Public() PublicError {
	message := e.PublicMessage
	if message == "" {
		if e.Reason == StatusUnknown {
			// The unknown status is equal to the empty string.
			message = string(StatusInternal)
		} else {
			message = string(e.Reason.Status())
		}
	}

	return PublicError{
		StatusCode: e.Reason.Status().HTTPStatus(),
		MessageID:  e.MessageID,
		Message:    message,
		Extra:      e.PublicPayload,
	}
}

// Error implements the error interface.
func (p PublicError) Error() string {
	return fmt.Sprintf("[%s] %s", p.MessageID, p.Message)
}
