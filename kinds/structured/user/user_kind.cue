package kind

name: "User"
maturity: "merged"

lineage: seqs: [
	{
		schemas: [
			// v0.0
			{
				// Email is the user's email.
				email: string
				// Name is the user's name.
				name: string
				// Login is the name used for login.
				login: string
				// Theme is Grafana theme used by the user.
				theme?: string @grafanamaturity(MaybeRemove)
				// OrgId is the org where the user belongs to.
				orgId?: string @grafanamaturity(ToMetadata="sys")
				// IsGrafanaAdmin indicates if the user belongs to Grafana.
				isGrafanaAdmin: bool
				// IsDisabled indicates if the user is disabled.
				isDisabled: bool
				// IsDisabled indicates if the user is external.
				isExternal: bool
				// AuthLabels is a list of authentication providers used (OAuth, SAML, LDAP...)
				authLabels: [...string]
				// CreatedAt indicates when the user was created.
				createdAt: int64 @grafanamaturity(ToMetadata="sys")
				// UpdatedAt indicates when the user was updated.
				updatedAt: int64 @grafanamaturity(ToMetadata="sys")
				// AvatarUrl is the user's avatar URL.
				avatarUrl: string
				// AccessControl metadata associated with a given resource.
				accessControl: [string]: bool @grafanamaturity(ToMetadata="sys")
			},
		]
	},
]
