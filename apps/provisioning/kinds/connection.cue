package repository

connection: {
	kind:       "Connection"
	pluralName: "Connections"
	current:    "v0alpha1"
	validation: {
		operations: [
			"CREATE",
			"UPDATE",
		]
	}
	versions: {
		"v0alpha1": {
			codegen: {
				ts: {enabled: false}
				go: {enabled: true}
			}
			schema: {
				#GitHubConnectionConfig: {
					// App-level information
					// GitHub App ID
					appID: int

					// Installation-level information
					// GitHub App installation ID
					installationID: int
				}
				#GitHubEnterpriseOAuthConnectionConfig: {
					// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
					serverUrl: string
				}
				#GitHubEnterpriseConnectionConfig: {
					// App-level information
					// GitHub App ID
					appID: int

					// Installation-level information
					// GitHub App installation ID
					installationID: int

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
					// The OAuth app clientID
					clientID: string
				}
				#ConnectionWebhookConfig: {
					// Disabled disables webhook integration for this connection. When true, the GitHub
					// App does not require webhooks:write permission and Grafana will not register or receive
					// webhook events. Use this when Grafana is not reachable from the public internet.
					disabled?: bool
				}
				#HealthStatus: {
					// When not healthy, requests will not be executed
					healthy: bool
					// When the health was checked last time
					checked?: int
					// Summary messages (can be shown to users)
					// Will only be populated when not healthy
					message?: [...string]
				}
				spec: {
					// The connection provider type
					type: "github" | "githubEnterprise" | "githubOAuth" | "githubEnterpriseOAuth" | "bitbucketOAuth" | "gitlabOAuth" | "gitOAuth"
					// The connection URL.
					url: *"" | string
					// GitHub connection configuration.
					// Only applicable when provider is "github".
					github?: #GitHubConnectionConfig
					// GitHub Enterprise Server connection configuration.
					// Only applicable when provider is "githubEnterprise".
					githubEnterprise?: #GitHubEnterpriseConnectionConfig
					// GitHub Enterprise Server OAuth app connection configuration.
					// Only applicable when provider is "githubEnterpriseOAuth".
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
					observedGeneration?: int
					// The connection health status
					health: #HealthStatus
				}
			}
		}
	}
}
