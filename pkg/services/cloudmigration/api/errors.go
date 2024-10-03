package api

// CloudMigrationAPIError is the shape of any non-2xx responses from cloudmigration API
type CloudMigrationAPIError struct {
	Status  *string `json:"status,omitempty"`
	Message string  `json:"message"`
}

// Error messages returned from GMS.
var (
	apiErrorMessagInstanceUnreachable = "instance is unreachable, make sure the instance is running"
)

// Human-friendly error messages that are returned by cloud migration API backend and are displayed in the on-prem instance.
// FIXME: Ideally we should be dealing with error codes here as well, and let the frontend generate the copies.
var (
	errorMessageTokenInvalid           = "Token is not valid. Regenerate the token and try again."
	errorMessageTokenValidationRequest = "There was an error validating the token." // what action?
	errorMessageInstanceUnreachable    = "Instance is not reachable. Make sure the instance is running and try again."
	errorMessageInstanceNotReached     = "There was an error checking if the instance is reachable." // what action?
	errorMessageCreateSessionFailed    = "There was an error creating the migration session."        // what action?
)
