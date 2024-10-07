package api

// Error messages returned from GMS
var (
	GMSErrorMessageInstanceUnreachable = "instance is unreachable"
	GMSErrorMessageInstanceNotFound    = "instance not found"
	GMSErrorMessageHttpRequestError    = "validate key http request error"
)

// Human-friendly error messages that are returned by cloud migration API backend and are displayed in the on-prem instance.
// FIXME: Ideally we should be dealing with error codes here as well, and let the frontend generate the copies.
var (
	ErrorMessageInvalidToken           = "Token is not valid. Generate a new token on your cloud instance and try again."
	ErrorMessageTokenValidationRequest = "An error occurred while validating the token. Please ensure the token matches the migration token on your cloud instance."
	ErrorMessageInstanceNotFound       = "The cloud instance cannot be found. Please ensure the cloud instance exists and is active."
	ErrorMessageInstanceUnreachable    = "The cloud instance cannot be reached. Make sure the instance is running and try again."
	ErrorMessageInstanceNotReached     = "An error occurred while attempting to verify the cloud instance's connectivity. Please check the network settings or cloud instance status."
	ErrorMessageCreateSessionFailed    = "There was an error creating the migration. Please try again."
)
