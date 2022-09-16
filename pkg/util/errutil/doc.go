// Package errutil provides utilities for working with errors in Grafana.
//
// Idiomatic errors in Grafana provides a combination of static and
// dynamic information that is useful to developers, system
// administrators and end users alike.
//
// Grafana itself can use the static information to infer the general
// category of error, retryability, log levels, and similar. A developer
// can combine static and dynamic information from logs to determine
// what went wrong and where even when access to the runtime environment
// is impossible. Server admins can use the information from the logs to
// monitor the health of their Grafana instance. End users will receive
// an appropriate amount of information to be able to correctly
// determine the best course of action when receiving an error.
//
// It is also important that implementing errors idiomatically comes
// naturally to experienced and beginner Go developers alike and is
// compatible with standard library features such as the ones in
// the errors package. To achieve this, Grafana's errors are divided
// into the Base and Error types, where the Base contains static
// information about a category of errors that may occur within a
// service and Error contains the combination of static and dynamic
// information for a particular instance of an error.
//
// A Base would typically be provided as a package-level variable for a
// service using the NewBase constructor with a CoreStatus and a unique
// static message ID that identifies the general structure of the public
// message attached to the specific error.
//
//	var errNotFound = errutil.NewBase(errutil.StatusNotFound, "service.not-found")
//
// This Base can now be used to construct a regular Go error with the
// Base.Errorf method using the same structure as fmt.Errorf:
//
//	return errNotFound.Errorf("looked for thing with ID %d, but it wasn't there: %w", id, err)
//
// By default, the end user will be sent the static message ID and a
// message which is the string representation of the CoreStatus. It is
// possible to override the message sent to the end user by using
// the WithPublicMessage functional option when creating a new Base
//
//	var errNotFound = errutil.NewBase(errutil.StatusNotFound "service.not-found", WithPublicMessage("The thing is missing."))
//
// If a dynamic message is needed, the Template type extends Base with a
// Go template using text/template from the standard library, refer to
// the documentation related to the Template type for usage examples.
// It is also possible, but discouraged, to manually edit the fields of
// an Error.
package errutil
