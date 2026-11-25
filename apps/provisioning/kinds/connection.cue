package repository

connection: {
	kind:       "Connection"
	pluralName: "Connections"
	validation: operations: ["CREATE", "UPDATE", "DELETE"]
	mutation: operations: ["CREATE", "UPDATE"]
	secure: [
		{key: "privateKey", description: "PrivateKey is the reference to the private key used for GitHub App authentication. This value is stored securely and cannot be read back"},
		{key: "clientSecret", description: "ClientSecret is the reference to the secret used for other providers authentication, and Github on-behalf-of authentication. This value is stored securely and cannot be read back"},
		{key: "token", description: "Token is the reference of the token used to act as the Connection. This value is stored securely and cannot be read back"},
	]
	schema: {
		#GitHubConnectionConfig: {
			// GitHub App ID
			appID: string
			// GitHub App installation ID
			installationID: string
		}
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
		#GitOAuthConnectionConfig: {
			// The provider's OAuth authorization endpoint (e.g. `https://gitlab.example.com/oauth/authorize`).
			authURL: string
			// The provider's OAuth token endpoint (e.g. `https://gitlab.example.com/oauth/token`).
			tokenURL: string
			// The OAuth scopes to request, granting git read and write access.
			scopes?: [...string]
		}
		#BitbucketConnectionConfig: {
			// The workspace the OAuth consumer belongs to
			workspace: string
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
		spec: {
			// The connection display name (shown in the UI)
			title: string
			// The connection description
			description?: string
			// The connection provider type
			type: "github" | "githubEnterprise" | "githubOAuth" | "githubEnterpriseOAuth" | "bitbucketOAuth" | "gitlabOAuth" | "gitOAuth"
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
			// +listType=atomic
			fieldErrors?: [...#ErrorDetails]
			// Conditions represent the latest available observations of the connection's state.
			// +listType=map
			// +listMapKey=type
			conditions?: [...#Condition]
			// The connection health status
			health: #HealthStatus
			// Token holds metadata about the last generated connection token, used to avoid
			// regenerating a token whose secret was written recently but is not yet readable.
			token?: #TokenStatus
		}
	}
}
