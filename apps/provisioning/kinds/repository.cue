package repository

repository: {
	kind:         "Repository"
	pluralName:   "Repositories"
	scope:        "Namespaced"
	folderScoped: false
	secure: [
		{key: "token"},
		{key: "webhookSecret"},
		{key: "commitSigningKey"},
	]
	schema: {
		#BitbucketRepositoryConfig: {
			// The repository URL (e.g. `https://bitbucket.org/example/test`).
			url?: string
			// The branch to use in the repository.
			branch: string
			// TokenUser is the user that will be used to access the repository if it's a personal access token.
			tokenUser?: string
			// Email is the Atlassian account email used to authenticate the Bitbucket REST API. Required to enable webhooks.
			email?: string
			// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
			// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
			// The path is relative to the root of the repository, regardless of the leading slash.
			// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
			path?: string
		}
		#BranchOptions: {
			// Template for the branch name created in branch workflow.
			// Supports variables: {{action}}, {{resourceKind}}, {{title}},
			// {{userLogin}}, {{random}}.
			// {{random}} is a 6-character alphanumeric token generated at render
			// time to avoid collisions. The result is sanitised to a valid git ref
			// (lowercase, alphanumeric + dashes, max 100 chars).
			// When empty, the current auto-generated name is preserved.
			nameTemplate?: string
			// When true, the branch name field in Save drawers is read-only.
			enforceTemplate?: bool
		}
		#CommitOptions: {
			// Template for commit messages produced by single-resource UI operations
			// (dashboard save/delete/move, folder create/rename/delete).
			// Bulk operations and sync jobs are out of scope and build their own messages.
			// Supports variables: {{action}}, {{resourceKind}}, {{resourceID}}, {{title}},
			// {{userName}}, {{userLogin}}, {{userEmail}}.
			// When empty, a built-in default is used (e.g. "Save dashboard: <title>").
			singleResourceMessageTemplate?: string
			// When true, the Comment field in Save drawers is pre-filled from
			// SingleResourceMessageTemplate and rendered read-only.
			enforceTemplate?: bool
			// Name used as the commit author instead of the user who triggered the
			// commit. Only valid when signingMethod is unset.
			authorName?: string
			// Email used as the commit author instead of the user who triggered the
			// commit. Only valid when signingMethod is unset.
			authorEmail?: string
			// Name used as the commit signer. Required for the signing key's identity
			// to match the commit, which providers need to mark commits as Verified. When
			// empty, defaults to "Grafana".
			signerName?: string
			// Email used as the commit signer. Must match the signing key's identity
			// and a verified email on the account where the matching public key is
			// registered. When empty, defaults to "noreply@grafana.com".
			signerEmail?: string
			// Method used to sign commits with the key in secure.commitSigningKey. One of "gpg", "ssh", or "smime".
			// When empty, commits are not signed.
			signingMethod?: "gpg" | "ssh" | "smime"
			// When true, commits are authored by the signer identity
			// (signerName/signerEmail).
			signerIsAuthor?: bool
			// PEM-encoded X.509 certificate paired with secure.commitSigningKey when
			// signingMethod is "smime". This is public (not a secret) and is embedded
			// in the commit signature. Unused for the gpg and ssh formats.
			smimeCertificate?: string
		}
		#Condition: {
			type:                string
			status:              "True" | "False" | "Unknown"
			observedGeneration?: int64
			lastTransitionTime:  string
			reason:              string
			message:             string
		}
		#ConnectionInfo: {
			name: string
		}

		// DeletionStatus reports the progress of an in-progress deletion and the problem
		// blocking it. It is populated while the repository is Terminating and its
		// finalizers run, so a client can explain the holdup and force-remove the
		// blocking finalizer.
		#DeletionStatus: {
			// State is the phase of the deletion.
			state?: "Blocked"
			// Finalizer names the finalizer whose teardown is blocking deletion, i.e.
			// which deletion step failed. A client force-removing deletion removes exactly
			// this finalizer.
			finalizer?: string
			// Message is a human-readable explanation of what went wrong, suitable for
			// showing to users.
			message?: string
			// Cause classifies the blocking error. It may be absent on older statuses.
			cause?: "user" | "system"
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

		// GitHubEnterpriseRepositoryConfig describes a repository hosted on a self-managed
		// GitHub Enterprise Server (GHES) instance.
		#GitHubEnterpriseRepositoryConfig: {
			// The GitHub Enterprise Server URL (e.g. `https://ghes.example.com`).
			serverUrl?: string
			// The repository URL on the GHES server (e.g. `https://ghes.example.com/example/test`).
			url?: string
			// The branch to use in the repository.
			branch: string
			// Path is the subdirectory for the Grafana data inside the repository.
			path?: string
		}
		#GitHubRepositoryConfig: {
			// The repository URL (e.g. `https://github.com/example/test`).
			url?: string
			// The branch to use in the repository.
			branch: string
			// Whether we should show dashboard previews for pull requests.
			// By default, this is false (i.e. we will not create previews).
			// TODO: deprecate this field in favor of PullRequestOptions.GenerateDashboardPreviews once all Github repositories have been backfilled.
			generateDashboardPreviews?: bool
			// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
			// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
			// The path is relative to the root of the repository, regardless of the leading slash.
			// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
			path?: string
		}
		#GitLabRepositoryConfig: {
			// The repository URL (e.g. `https://gitlab.com/example/test`).
			url?: string
			// The branch to use in the repository.
			branch: string
			// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
			// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
			// The path is relative to the root of the repository, regardless of the leading slash.
			// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
			path?: string
			// RepoID is the GitLab project's immutable numeric ID. Resolved and set
			// automatically whenever URL is set or changed; it survives a project
			// transfer/move even if the project's path changes. Read-only: it is
			// always system-derived and never taken from client-supplied input.
			repoID?: string
		}
		#GitRepositoryConfig: {
			// The repository URL (e.g. `https://github.com/example/test`).
			url?: string
			// The branch to use in the repository.
			branch: string
			// TokenUser is the user that will be used to access the repository if it's a personal access token.
			tokenUser?: string
			// Path is the subdirectory for the Grafana data. If specified, Grafana will ignore anything that is outside this directory in the repository.
			// This is usually something like `grafana/`. Trailing and leading slash are not required. They are always added when needed.
			// The path is relative to the root of the repository, regardless of the leading slash.
			// When specifying something like `grafana-`, we will not look for `grafana-*`; we will only look for files under the directory `/grafana-/`. That means `/grafana-example.json` would not be found.
			path?: string
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
		#LocalRepositoryConfig: {
			path?: string
		}
		#PullRequestOptions: {
			// Template for pull request titles.
			// Supports the same variables as BranchOptions.NameTemplate
			// ({{random}} is available but rarely useful here).
			// When empty, the first line of the commit message is used.
			titleTemplate?: string
			// When true, the PR title field in Save drawers is read-only.
			enforceTemplate?: bool
			// Whether we should show dashboard previews for pull requests.
			// By default, this is false (i.e. we will not create previews).
			generateDashboardPreviews?: bool
		}

		// QuotaStatus represents the quota limits configured for this repository.
		#QuotaStatus: {
			// MaxRepositories is the maximum number of repositories allowed.
			// 0 means unlimited.
			maxRepositories?: int64
			// MaxResourcesPerRepository is the maximum number of resources allowed per repository.
			// 0 means unlimited.
			maxResourcesPerRepository?: int64
			// UpdatedAt is when the controller last successfully refreshed these quota limits.
			// It is expressed as Unix milliseconds. 0 means the quota limits have not been refreshed yet.
			updatedAt?: int64
		}
		#ResourceCount: {
			group:    string
			resource: string
			count:    int64
		}
		#SyncOptions: {
			// Enabled must be saved as true before any sync job will run
			enabled: bool
			// Where values should be saved
			target: "instance" | "folder" | "folderless"
			// The interval between sync runs.
			// The system defines a default value for this field, which will overwrite the
			// user-defined one in case the latter is zero or lower than the system-defined one.
			intervalSeconds?: int64
		}
		#SyncStatus: {
			// pending, running, success, error
			state: "pending" | "working" | "success" | "error" | "warning"
			// The ID for the job that ran this sync
			job?: string
			// When the sync job started
			started?: int64
			// When the sync job finished
			finished?: int64
			// When the controller last attempted a sync or an interval check (Unix milliseconds).
			lastChecked?: int64
			// When the next sync check is scheduled
			scheduled?: int64
			// Summary messages (will be shown to users)
			message: [...string]
			// The repository ref when the last successful sync ran
			lastRef?: string
			// Incremental synchronization for versioned repositories
			incremental?: bool
		}
		#TokenStatus: {
			lastUpdated?: int64
			expiration?:  int64
		}
		#WebhookConfig: {
			// Base URL of the Grafana instance used to construct the webhook endpoint
			// registered with the external Git provider. Only the base URL should be
			// provided (e.g. `https://grafana.example.com`); the API path, namespace,
			// and resource name are appended automatically. Trailing slashes are stripped.
			// Must be a valid HTTP or HTTPS URL.
			baseUrl?: string
			// Disabled turns off webhook integration for this repository. When true,
			// Grafana will not register or receive webhook events from the Git provider
			// and will poll the repository on an interval instead. Use this when Grafana
			// is not reachable from the public internet.
			disabled?: bool
		}
		#WebhookStatus: {
			// TODO: consolidate ID and UUID into a single string identifier in the next api version.
			id?:   int64
			uuid?: string
			url?:  string
			subscribedEvents?: [...string]
			lastEvent?:   int64
			lastRotated?: int64
		}
		spec: {
			// The repository display name (shown in the UI)
			title: string
			// Repository description
			description?: string
			// Commit message options. Currently only contains the template used by
			// single-resource UI operations; future siblings (bulk, sync) can live here.
			commit?: #CommitOptions
			// Branch naming options. Only meaningful when Workflows includes "branch".
			branch?: #BranchOptions
			// Pull request options. Only meaningful when Workflows includes "branch".
			pullRequest?: #PullRequestOptions
			// UI driven Workflow that allow changes to the contends of the repository.
			// The order is relevant for defining the precedence of the workflows.
			// When empty, the repository does not support any edits (eg, readonly)
			workflows: [..."write" | "branch"]
			// Sync settings -- how values are pulled from the repository into grafana
			sync: #SyncOptions
			// The repository type.  When selected oneOf the values below should be non-nil
			type: "local" | "github" | "githubEnterprise" | "git" | "bitbucket" | "gitlab"
			// Webhook settings for the repository.
			// When specified, the base URL overrides the auto-detected Grafana public URL
			// used to register webhooks with the external Git provider.
			webhook?: #WebhookConfig
			// The repository on the local file system.
			// Mutually exclusive with local | github.
			local?: #LocalRepositoryConfig
			// The repository on GitHub.
			// Mutually exclusive with local | github | git.
			github?: #GitHubRepositoryConfig
			// The repository on a self-managed GitHub Enterprise Server (GHES).
			// Mutually exclusive with local | github | git.
			githubEnterprise?: #GitHubEnterpriseRepositoryConfig
			// The repository on Git.
			// Mutually exclusive with local | github | git.
			git?: #GitRepositoryConfig
			// The repository on Bitbucket.
			// Mutually exclusive with local | github | git.
			bitbucket?: #BitbucketRepositoryConfig
			// The repository on GitLab.
			// Mutually exclusive with local | github | git.
			gitlab?: #GitLabRepositoryConfig
			// The connection the repository references.
			// This means the Repository is interacting with git via a Connection.
			connection?: #ConnectionInfo
		}
		status: {
			// The generation of the spec last time reconciliation ran
			observedGeneration: int64
			// FieldErrors are errors that occurred during validation of the repository spec.
			// These errors are intended to help users identify and fix issues in the spec.
			fieldErrors?: [...#ErrorDetails]
			// Conditions represent the latest available observations of the repository's state.
			conditions?: [...#Condition]
			// This will get updated with the current health status (and updated periodically)
			health: #HealthStatus
			// Sync information with the last sync information
			sync: #SyncStatus
			// The object count when sync last ran
			stats?: [...#ResourceCount]
			// Webhook Information (if applicable)
			webhook: #WebhookStatus
			// Token will get updated with current token information
			token?: #TokenStatus
			// Error information during repository deletion (if any).
			// Deprecated: prefer the structured Deletion field. Retained for
			// backwards compatibility with clients that read the concise string.
			deleteError?: string
			// Deletion reports the progress of an in-progress deletion and the problem
			// blocking it, so a client can explain the holdup and force-remove the
			// blocking finalizer. Populated only while the repository is Terminating.
			deletion?: #DeletionStatus
			// Quota contains the configured quota limits for this repository
			quota?: #QuotaStatus
		}
	}
}
