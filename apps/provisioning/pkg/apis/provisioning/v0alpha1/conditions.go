package v0alpha1

// Condition types for Repository resources
const (
	// ConditionTypeReady indicates the overall readiness of the repository
	ConditionTypeReady = "Ready"

	// ConditionTypeHealthy indicates whether health checks pass
	ConditionTypeHealthy = "Healthy"

	// ConditionTypeSynced indicates the sync job status
	ConditionTypeSynced = "Synced"

	// ConditionTypeValidated indicates spec validation status
	ConditionTypeValidated = "Validated"

	// ConditionTypeQuotaCompliant indicates whether the repository is within quota limits
	ConditionTypeQuotaCompliant = "QuotaCompliant"

	// ConditionTypeSecretsConfigured indicates whether required secrets are set up
	ConditionTypeSecretsConfigured = "SecretsConfigured"

	// ConditionTypeWebhookConfigured indicates whether webhooks are registered
	ConditionTypeWebhookConfigured = "WebhookConfigured"
)

// Reasons for Ready condition
const (
	// ReasonRepositoryReady indicates the repository is fully ready
	ReasonRepositoryReady = "RepositoryReady"

	// ReasonHealthCheckFailed indicates health checks have failed
	ReasonHealthCheckFailed = "HealthCheckFailed"

	// ReasonSyncFailed indicates sync job has failed
	ReasonSyncFailed = "SyncFailed"

	// ReasonValidationFailed indicates spec validation has failed
	ReasonValidationFailed = "ValidationFailed"

	// ReasonQuotaExceeded indicates a quota limit has been exceeded
	ReasonQuotaExceeded = "QuotaExceeded"

	// ReasonSecretsNotConfigured indicates required secrets are not configured
	ReasonSecretsNotConfigured = "SecretsNotConfigured"

	// ReasonReconciling indicates reconciliation is in progress
	ReasonReconciling = "Reconciling"
)

// Reasons for Healthy condition
const (
	// ReasonHealthCheckPassed indicates health check succeeded
	ReasonHealthCheckPassed = "HealthCheckPassed"

	// ReasonHookFailed indicates a hook execution failed
	ReasonHookFailed = "HookFailed"

	// ReasonConnectionUnhealthy indicates the referenced connection is unhealthy
	ReasonConnectionUnhealthy = "ConnectionUnhealthy"

	// ReasonRepositoryNotFound indicates the repository doesn't exist on the provider
	ReasonRepositoryNotFound = "RepositoryNotFound"

	// ReasonBranchNotFound indicates the specified branch doesn't exist
	ReasonBranchNotFound = "BranchNotFound"

	// ReasonInsufficientPermissions indicates the token lacks required permissions
	ReasonInsufficientPermissions = "InsufficientPermissions"
)

// Reasons for Synced condition
const (
	// ReasonSyncSucceeded indicates sync completed successfully
	ReasonSyncSucceeded = "SyncSucceeded"

	// ReasonSyncInProgress indicates sync is currently running
	ReasonSyncInProgress = "SyncInProgress"

	// ReasonSyncPending indicates sync is queued
	ReasonSyncPending = "SyncPending"

	// ReasonSyncDisabled indicates sync is disabled
	ReasonSyncDisabled = "SyncDisabled"
)

// Reasons for Validated condition
const (
	// ReasonValidationSucceeded indicates all validations passed
	ReasonValidationSucceeded = "ValidationSucceeded"

	// ReasonFieldValidationFailed indicates field validation failed
	ReasonFieldValidationFailed = "FieldValidationFailed"

	// ReasonConnectionNotFound indicates the referenced connection doesn't exist
	ReasonConnectionNotFound = "ConnectionNotFound"

	// ReasonInvalidAppID indicates the GitHub App ID is invalid
	ReasonInvalidAppID = "InvalidAppID"

	// ReasonInvalidInstallationID indicates the GitHub installation ID is invalid
	ReasonInvalidInstallationID = "InvalidInstallationID"

	// ReasonInvalidURL indicates the repository URL is invalid
	ReasonInvalidURL = "InvalidURL"
)

// Reasons for QuotaCompliant condition (placeholders for future implementation)
const (
	// ReasonWithinQuota indicates the repository is within quota limits
	ReasonWithinQuota = "WithinQuota"

	// ReasonRepositoryCountExceeded indicates too many repositories for the tier
	ReasonRepositoryCountExceeded = "RepositoryCountExceeded"

	// ReasonResourceQuotaExceeded indicates too many resources managed by this repository
	ReasonResourceQuotaExceeded = "ResourceQuotaExceeded"
)

// Reasons for SecretsConfigured condition
const (
	// ReasonSecretsReady indicates all required secrets are configured
	ReasonSecretsReady = "SecretsReady"

	// ReasonTokenPending indicates token configuration is in progress
	ReasonTokenPending = "TokenPending"

	// ReasonTokenFailed indicates token configuration failed
	ReasonTokenFailed = "TokenFailed"

	// ReasonConnectionNotReady indicates the referenced connection is not ready
	ReasonConnectionNotReady = "ConnectionNotReady"

	// ReasonInstallationDisabled indicates the GitHub App installation is disabled
	ReasonInstallationDisabled = "InstallationDisabled"

	// ReasonWebhookSecretPending indicates webhook secret generation is in progress
	ReasonWebhookSecretPending = "WebhookSecretPending"

	// ReasonWebhookSecretFailed indicates webhook secret generation failed
	ReasonWebhookSecretFailed = "WebhookSecretFailed"

	// ReasonSecretsNotRequired indicates no secrets are required
	ReasonSecretsNotRequired = "NotRequired"
)

// Reasons for WebhookConfigured condition
const (
	// ReasonWebhookCreated indicates webhook was successfully registered
	ReasonWebhookCreated = "WebhookCreated"

	// ReasonWebhookFailed indicates webhook registration failed
	ReasonWebhookFailed = "WebhookFailed"

	// ReasonWebhookNotRequired indicates webhook is not required
	ReasonWebhookNotRequired = "WebhookNotRequired"

	// ReasonSecretNotReady indicates webhook secret is not ready
	ReasonSecretNotReady = "SecretNotReady"
)

// Additional reasons for Connected condition (used by Connection resources)
const (
	// ReasonConnected indicates connection test succeeded
	ReasonConnected = "Connected"

	// ReasonDisconnected indicates connection is not established
	ReasonDisconnected = "Disconnected"

	// ReasonTestSucceeded indicates connection test succeeded
	ReasonTestSucceeded = "TestSucceeded"

	// ReasonTestFailed indicates connection test failed
	ReasonTestFailed = "TestFailed"

	// ReasonAuthenticationFailed indicates authentication failed
	ReasonAuthenticationFailed = "AuthenticationFailed"

	// ReasonAuthorizationRevoked indicates OAuth authorization was revoked
	ReasonAuthorizationRevoked = "AuthorizationRevoked"

	// ReasonNetworkUnreachable indicates network connectivity issues
	ReasonNetworkUnreachable = "NetworkUnreachable"

	// ReasonInvalidCredentials indicates credentials are invalid
	ReasonInvalidCredentials = "InvalidCredentials"
)
