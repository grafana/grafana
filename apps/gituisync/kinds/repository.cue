package core

externalName: {
	kind:       "Repository"
	pluralName: "Repositories"
	group:      "gituisync"
	apiResource: {
		groupOverride: "gituisync.grafana.app"
		mutation: operations: ["create", "update"]
		validation: operations: ["create", "update"]
	}
	codegen: {
		frontend: false
		backend:  true
	}

	current: "v0alpha1"
	versions: {
		"v0alpha1": {
			schema: {
				spec: {
					#LocalRepo: {
						type: "local"
						path: string
					}
					#S3Repo: {
						type: "s3"
						// TODO: Add ACL?
						// TODO: Encryption??
						bucket: string
					}
					#GitHubRepo: {
						// TODO: github or just 'git'??
						type: "github"
						// TODO: Do we want an SSH url instead maybe?
						owner:      string
						repository: string
						// TODO: On-prem GitHub Enterprise support?
					}
					repository: #LocalRepo | #S3Repo | #GitHubRepo
				}
			}
		}
	}
}
