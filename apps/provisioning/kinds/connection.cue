package repository

connection: {
	kind:         "Connection"
	pluralName:   "Connections"
	scope:        "Namespaced"
	folderScoped: false
	secure: [
		{key: "privateKey"},
		{key: "clientSecret"},
		{key: "token"},
	]
	schema: {
		#BitbucketConnectionConfig: {
			// The workspace the OAuth consumer belongs to
			workspace: string
		}
		#Condition: {
			type:                string
			status:              "True" | "False" | "Unknown"
			observedGeneration?: int64
			lastTransitionTime:  string
			reason:              string
			message:             string
		}
		#ConnectionOAuthConfig: {
			// The OAuth app client ID
			clientID: string
		}
		#ConnectionWebhookConfig: {
			// Disabled disables webhook integration for this connection. When true, the GitHub
			// App does not require webhooks:write permission and Grafana will not register or receive
			// webhook events. Use this when Grafana is not reachable from the public internet.
			disabled?: bool
		}

		// ErrorDetails describes an individual field error intended to help users identify and fix issues
		// in resource specifications. This type is modeled after Kubernetes' StatusCause and serves the same
		// purpose: to deliver actionable feedback about fields in the spec that require attention.
		// Errors may relate to invalid formats, missing or invalid values, or cases where a referenced value
		// does not exist in an external system (not strictly format or syntax errors). Use ErrorDetails to
		// communicate validation or external reference errors that users can resolve by editing spec fields.
		// TODO: Rename this type to FieldError for consistency with Kubernetes conventions and to more clearly indicate that it represents field-level validation errors, not arbitrary error details.
		#ErrorDetails: {
			// Type is a machine-readable description of the cause of the error.
			// This is intended for programmatic handling and matches Kubernetes' CauseType values.
			type: string
			// Field is the path to the field or JSON pointer that caused the error.
			// This helps users and tools identify exactly where to correct the problem.
			// This field is optional and may be empty if not applicable.
			field?: string
			// Detail provides a human-readable explanation of what went wrong.
			// This message may be shown directly to users and should be actionable.
			detail?: string
			// Origin indicates where the error originated in validation, or the name of the external service that reported the error.
			// This can be useful for tooling or debugging, and may reference a specific rule, function, or service.
			// This field is optional and may be empty.
			origin?: string
			// BadValue is the value of the field that was determined to be invalid, if applicable.
			// This can be any type. This field is optional and may be omitted if not relevant.
			badValue?: _
		}
		#GitHubConnectionConfig: {
			// GitHub App ID
			appID: string
			// GitHub App installation ID
			installationID: string
		}

		// GitHubEnterpriseConnectionConfig describes a GitHub App installation against a
		// self-managed GitHub Enterprise Server (GHES) instance.
		#GitHubEnterpriseConnectionConfig: {
			// GitHub App ID
			appID: string
			// GitHub App installation ID
			installationID: string
			// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
			serverUrl: string
		}
		#GitHubEnterpriseOAuthConnectionConfig: {
			// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
			serverUrl: string
		}

		// GitOAuthConnectionConfig describes a provider-agnostic OAuth 2.0 app used to
		// authenticate pure git repositories.
		#GitOAuthConnectionConfig: {
			// The provider's OAuth authorization endpoint (e.g. `https://gitlab.example.com/oauth/authorize`).
			authURL: string
			// The provider's OAuth token endpoint (e.g. `https://gitlab.example.com/oauth/token`).
			tokenURL: string
			// The OAuth scopes to request, granting git read and write access.
			scopes?: [...string]
		}
		#HealthStatus: {
			// When not healthy, requests will not be executed
			healthy: bool
			// The type of the error
			error?: "hook" | "health"
			// When the health was checked last time
			checked?: int64
			// Summary messages (can be shown to users)
			// Will only be populated when not healthy
			message?: [...string]
		}
		#TokenStatus: {
			lastUpdated?: int64
			expiration?:  int64
		}
		spec: {
			// The connection display name (shown in the UI)
			title: string
			// The connection description
			description?: string
			// The connection provider type
			type: "github" | "githubEnterprise" | "githubOAuth" | "githubEnterpriseOAuth" | "gitlabOAuth" | "bitbucketOAuth" | "gitOAuth"
			// The connection URL
			url?: string
			// GitHub connection configuration
			// Only applicable when provider is "github"
			github?: #GitHubConnectionConfig
			// GitHub Enterprise Server connection configuration
			// Only applicable when provider is "githubEnterprise"
			githubEnterprise?: #GitHubEnterpriseConnectionConfig
			// GitHub Enterprise Server OAuth app connection configuration
			// Only applicable when provider is "githubEnterpriseOAuth"
			githubEnterpriseOAuth?: #GitHubEnterpriseOAuthConnectionConfig
			// Bitbucket connection configuration
			// Only applicable when provider is "bitbucketOAuth"
			bitbucket?: #BitbucketConnectionConfig
			// Generic git OAuth app connection configuration
			// Only applicable when provider is "gitOAuth"
			gitOAuth?: #GitOAuthConnectionConfig
			// OAuth app configuration shared by all OAuth app providers
			oauth?: #ConnectionOAuthConfig
			// Webhook configuration for this connection
			webhook?: #ConnectionWebhookConfig
		}
		status: {
			// The generation of the spec last time reconciliation ran
			observedGeneration: int64
			// FieldErrors are errors that occurred during validation of the connection spec.
			// These errors are intended to help users identify and fix issues in the spec.
			fieldErrors?: [...#ErrorDetails]
			// Conditions represent the latest available observations of the connection's state.
			conditions?: [...#Condition]
			// The connection health status
			health: #HealthStatus
			// Token holds metadata about the last generated connection token, used to avoid
			// regenerating a token whose secret was written recently but is not yet readable.
			token?: #TokenStatus
		}
	}
}
