package api

// Error messages returned from GMS
var (
	GMSErrorInstanceUnreachable = "instance is unreachable"
	GMSErrorInstanceNotFound    = "instance not found"
)

// Human-friendly error messages that are returned by cloud migration API backend and are displayed in the on-prem instance.
// FIXME: Ideally we should be dealing with error codes here as well, and let the frontend generate the copies.
var (
	ErrorMessageInvalidToken           = "Token is not valid. Regenerate the token and try again."
	ErrorMessageTokenValidationRequest = "An error occured while validating the token. Please ensure the token is valid."
	ErrorMessageInstanceNotFound       = "The stack cannot be found. Make sure the stack is running and try again."
	ErrorMessageInstanceUnreachable    = "The stack cannot be reached. Make sure the stack is running and try again."
	ErrorMessageInstanceNotReached     = "An error occurred while attempting to verify the stack's connectivity. Please check the network settings or stack status."
	ErrorMessageCreateSessionFailed    = "There was an error creating the migration." // TODO: what action?
)
