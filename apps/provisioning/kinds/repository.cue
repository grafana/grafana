package repository

repository: {
	kind:	   "Repository"
	pluralName: "Repositories"
	current:	"v0alpha1"
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
				#LocalRepositoryConfig: {
					// Path to the local repository
					path: string
				}
				#GitHubRepositoryConfig: {
					// The repository URL (e.g. `https://github.com/example/test`).
					url?: string
					// The branch to use in the repository.
					branch: string
					// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
					token?: string
					// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
					encryptedToken?: [...string]
					// Whether we should show dashboard previews for pull requests.
					// By default, this is false (i.e. we will not create previews).
					generateDashboardPreviews?: bool
					// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
					path?: string
				}
				#GitRepositoryConfig: {
					// The repository URL (e.g. `https://github.com/example/test.git`).
					url?: string
					// The branch to use in the repository.
					branch: string
					// TokenUser is the user that will be used to access the repository if it's a personal access token.
					tokenUser?: string
					// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
					token?: string
					// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
					encryptedToken?: [...string]
					// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
					path?: string
				}
				#BitbucketRepositoryConfig: {
					// The repository URL (e.g. `https://bitbucket.org/example/test`).
					url?: string
					// The branch to use in the repository.
					branch: string
					// TokenUser is the user that will be used to access the repository if it's a personal access token.
					tokenUser?: string
					// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
					token?: string
					// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
					encryptedToken?: [...string]
					// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
					path?: string
				}
				#GitLabRepositoryConfig: {
					// The repository URL (e.g. `https://gitlab.com/example/test`).
					url?: string
					// The branch to use in the repository.
					branch: string
					// Token for accessing the repository. If set, it will be encrypted into encryptedToken, then set to an empty string again.
					token?: string
					// Token for accessing the repository, but encrypted. This is not possible to read back to a user decrypted.
					encryptedToken?: [...string]
					// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
					path?: string
				}
				#SyncOptions: {
					// Enabled must be saved as true before any sync job will run
					enabled: bool
					// Where values should be saved
					target: "unified" | "legacy"
					// When non-zero, the sync will run periodically
					intervalSeconds?: int
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
				#SyncStatus: {
					// pending, running, success, error
					state: "pending" | "running" | "success" | "error"
					// The ID for the job that ran this sync
					job?: string
					// When the sync job started
					started?: int
					// When the sync job finished
					finished?: int
					// When the next sync check is scheduled
					scheduled?: int
					// Summary messages (will be shown to users)
					message: [...string]
					// The repository ref when the last successful sync ran
					lastRef?: string
					// Incremental synchronization for versioned repositories
					incremental?: bool
				}
				#ResourceCount: {
					group:    string
					resource: string
					count:    int
				}
				#WebhookStatus: {
					id?:               int
					url?:              string
					secret?:           string
					encryptedSecret?:  [...string]
					subscribedEvents?: [...string]
					lastEvent?:        int
				}
				spec: {
					// The repository display name (shown in the UI)
					title: string
					// Repository description
					description?: string
					// UI driven Workflow that allow changes to the contends of the repository.
					// The order is relevant for defining the precedence of the workflows.
					// When empty, the repository does not support any edits (eg, readonly)
					workflows?: [...string]
					// Sync settings -- how values are pulled from the repository into grafana
					sync: #SyncOptions
					// The repository type. When selected oneOf the values below should be non-nil
					type: "local" | "github" | "git" | "bitbucket" | "gitlab"
					// The repository on the local file system.
					// Mutually exclusive with local | github.
					local?: #LocalRepositoryConfig
					// The repository on GitHub.
					// Mutually exclusive with local | github | git.
					github?: #GitHubRepositoryConfig
					// The repository on Git.
					// Mutually exclusive with local | github | git.
					git?: #GitRepositoryConfig
					// The repository on Bitbucket.
					// Mutually exclusive with local | github | git.
					bitbucket?: #BitbucketRepositoryConfig
					// The repository on GitLab.
					// Mutually exclusive with local | github | git.
					gitlab?: #GitLabRepositoryConfig
				}
				status: {
					// The generation of the spec last time reconciliation ran
					observedGeneration?: int
					// This will get updated with the current health status (and updated periodically)
					health: #HealthStatus
					// Sync information with the last sync information
					sync: #SyncStatus
					// The object count when sync last ran
					stats?: [...#ResourceCount]
					// Webhook Information (if applicable)
					webhook?: #WebhookStatus
				}
			}
		}
	}
} 