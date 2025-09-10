package conversion

import "fmt"

var _ error = &ConversionError{}

// NewConversionError creates a new ConversionError with the given message, current API version, target API version, and function name
func NewConversionError(msg string, currentAPIVersion, targetAPIVersion string, functionName string) *ConversionError {
	return &ConversionError{
		msg:               msg,
		currentAPIVersion: currentAPIVersion,
		targetAPIVersion:  targetAPIVersion,
		functionName:      functionName,
	}
}

// ConversionError is an error type for conversion errors
type ConversionError struct {
	msg               string
	functionName      string
	currentAPIVersion string
	targetAPIVersion  string
}

func (e *ConversionError) Error() string {
	return fmt.Sprintf("conversion from %s to %s failed in %s: %s", e.currentAPIVersion, e.targetAPIVersion, e.functionName, e.msg)
}

// GetFunctionName returns the name of the conversion function that failed
func (e *ConversionError) GetFunctionName() string {
	return e.functionName
}

// GetCurrentAPIVersion returns the current API version
func (e *ConversionError) GetCurrentAPIVersion() string {
	return e.currentAPIVersion
}

// GetTargetAPIVersion returns the target API version
func (e *ConversionError) GetTargetAPIVersion() string {
	return e.targetAPIVersion
}
