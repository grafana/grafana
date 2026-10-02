package v0alpha1

AuthInfoSpec: {
	userRef: UserRef

	// authModule is the external auth provider the user is linked through (e.g. "github", "ldap", "saml").
	authModule: string

	// authID is the identifier the auth provider returns at login (OAuth subject, LDAP DN, SAML NameID).
	authID: string

	// externalUID is the external unique identifier of the user, used for provisioning
	// systems such as SCIM to correlate the user without relying on authID.
	externalUID?: string

	// created is the creation timestamp of the auth link, in epoch milliseconds.
	created?: int64
}

UserRef: {
	// Name is the unique identifier (UID) for a user.
	name: string
}
