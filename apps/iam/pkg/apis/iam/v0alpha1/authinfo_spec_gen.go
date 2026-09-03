// Code generated - EDITING IS FUTILE. DO NOT EDIT.

package v0alpha1

// +k8s:openapi-gen=true
type AuthInfoUserRef struct {
	// Name is the unique identifier (UID) for a user.
	Name string `json:"name"`
}

// NewAuthInfoUserRef creates a new AuthInfoUserRef object.
func NewAuthInfoUserRef() *AuthInfoUserRef {
	return &AuthInfoUserRef{}
}

// OpenAPIModelName returns the OpenAPI model name for AuthInfoUserRef.
func (AuthInfoUserRef) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.AuthInfoUserRef"
}

// +k8s:openapi-gen=true
type AuthInfoSpec struct {
	UserRef AuthInfoUserRef `json:"userRef"`
	// authModule is the external auth provider the user is linked through (e.g. "github", "ldap", "saml").
	AuthModule string `json:"authModule"`
	// authID is the identifier the auth provider returns at login (OAuth subject, LDAP DN, SAML NameID).
	AuthID string `json:"authID"`
	// externalUID is the external unique identifier of the user, used for provisioning
	// systems such as SCIM to correlate the user without relying on authID.
	ExternalUID *string `json:"externalUID,omitempty"`
	// created is the creation timestamp of the auth link, in epoch milliseconds.
	Created *int64 `json:"created,omitempty"`
}

// NewAuthInfoSpec creates a new AuthInfoSpec object.
func NewAuthInfoSpec() *AuthInfoSpec {
	return &AuthInfoSpec{
		UserRef: *NewAuthInfoUserRef(),
	}
}

// OpenAPIModelName returns the OpenAPI model name for AuthInfoSpec.
func (AuthInfoSpec) OpenAPIModelName() string {
	return "com.github.grafana.grafana.apps.iam.pkg.apis.iam.v0alpha1.AuthInfoSpec"
}
