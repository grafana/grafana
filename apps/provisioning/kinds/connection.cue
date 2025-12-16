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
				#BitbucketConnectionConfig: {
					// The app clientID
					clientID: string
				}
				#GitlabConnectionConfig: {
					// The app clientID
					clientID: string
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
					type: "github" | "bitbucket" | "gitlab"
					// The connection URL
					url: *"" | string
					// GitHub connection configuration
					// Only applicable when provider is "github"
					github?: #GitHubConnectionConfig
					// Bitbucket connection configuration
					// Only applicable when provider is "bitbucket"
					bitbucket?: #BitbucketConnectionConfig
					// Gitlab connection configuration
					// Only applicable when provider is "gitlab"
					gitlab?: #GitlabConnectionConfig
				}
				status: {
					// The generation of the spec last time reconciliation ran
					observedGeneration?: int
					// Connection state
					state: "connected" | "disconnected"
					// The connection health status
					health: #HealthStatus
				}
			}
		}
	}
}

