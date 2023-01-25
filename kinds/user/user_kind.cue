package kind

name:     "User"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				// Numeric instance unique numeric identifier.
				id?: int64

				// The email address associated with the user. Does not
				// necessarily hold an email address.
				email: *login | string @cuetsy(kind="type")

				// Display name, for showing in lists to end users.
				name: string

				// The username that can be used to log in the user and can be
				// used to distinguish between two equal names. Unique within
				// an instance.
				login: *email | string @cuetsy(kind="type")

				// User-specific theme preference.
				theme?: "dark" | "light" @cuetsy(kind="enum")

				// The currently active organization for the given user.
				orgId?: int64

				// Whether the user has the Grafana Admin flag set to grant
				// additional permissions for managing the instance.
				isGrafanaAdmin: *false | bool

				// Disabled users are unable to log in.
				isDisabled: *false | bool

				// External users are authenticated through an external
				// source of authentication.
				isExternal: *false | bool

				// For external users, this contains the type of the
				// authentication provider used to authenticate the user.
				authLabels?: [...string]

				// The Gravatar URL associated with the user's email.
				avatarUrl?: string

				// Access control metadata associated with the user.
				accessControl?: {
					[string]: bool @grafanamaturity(ToMetadata="sys")
				}

				// Created indicates when the user was created.
				created: int64 @grafanamaturity(ToMetadata="sys")

				// Updated indicates when the user was most recently updated.
				updated: int64 @grafanamaturity(ToMetadata="sys")
			},
		]
	},
]
