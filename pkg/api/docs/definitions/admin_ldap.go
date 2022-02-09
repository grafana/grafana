package definitions

// swagger:route POST /admin/ldap/reload admin_ldap reloadLDAP
//
// Reloads the LDAP configuration.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.config:reload`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route POST /admin/ldap/sync/{user_id} admin_ldap syncLDAPUser
//
// Enables a single Grafana user to be synchronized against LDAP.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.user:sync`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /admin/ldap/{user_name} admin_ldap getLDAPUser
//
// Finds an user based on a username in LDAP. This helps illustrate how would the particular user be mapped in Grafana when synced.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.user:read`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:route GET /admin/ldap/status admin_ldap getLDAPStatus
//
// Attempts to connect to all the configured LDAP servers and returns information on whenever they're available or not.
//
// If you are running Grafana Enterprise and have Fine-grained access control enabled, you need to have a permission with action `ldap.status:read`.
//
// Security:
// - basic:
//
// Responses:
// 200: okResponse
// 401: unauthorisedError
// 403: forbiddenError
// 500: internalServerError

// swagger:parameters getLDAPUser
type UserNameParam struct {
	// in:path
	// required:true
	UserID string `json:"user_name"`
}
