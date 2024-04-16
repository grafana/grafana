package social

import (
	"crypto"
	"crypto/x509"
	"fmt"
	"text/template"
	"time"

	"github.com/crewjam/saml"
	"github.com/grafana/grafana/pkg/services/org"
)

// Config holds needed configuration options to enable Grafana to act as a SAML Service Provider (SP)
//
// SAML SPs use asymmetric encryption in order to exchange information with the IdP, per the AES
// we need both a public (Certificate) and a private part (PrivateKey).
//
// The IdP metadata lets the SP know how to communicate and where to send the requests to.
//
// MaxIssueDelay is specified in seconds and helps prevent SAML assertions replays
type SAMLInfo struct {
	AllowIdPInitiated        bool                              `json:"allow_id_p_initiated"`
	AllowSignup              bool                              `json:"allow_signup"`
	AllowedOrganizations     []string                          `json:"allowed_organizations"`
	Certificate              *x509.Certificate                 `json:"certificate"`
	Enabled                  bool                              `json:"enabled"`
	IdentityProviderMetadata func() ([]byte, error)            `json:"-"`
	Mapping                  *AssertionMapping                 `json:"mapping"`
	MaxIssueDelay            time.Duration                     `json:"max_issue_delay"`
	MetadataValidDuration    time.Duration                     `json:"metadata_valid_duration"`
	NameIDFormat             saml.NameIDFormat                 `json:"name_id_format"`
	OrgMapping               map[string]map[int64]org.RoleType `json:"org_mapping"`
	PrivateKey               *crypto.PrivateKey                `json:"-"`
	RelayState               string                            `json:"relay_state"`
	RoleValuesAdmin          []string                          `json:"role_values_admin"`
	RoleValuesEditor         []string                          `json:"role_values_editor"`
	RoleValuesGrafanaAdmin   []string                          `json:"role_values_grafana_admin"`
	RoleValuesNone           []string                          `json:"role_values_none"`
	SignatureAlgorithm       string                            `json:"signature_algorithm"`
	SingleLogoutEnabled      bool                              `json:"single_logout_enabled"`
	SkipOrgRoleSync          bool                              `json:"skip_org_role_sync"`
}

// AssertionMapping holds the details of how to map the user information from the SAML assertion
type AssertionMapping struct {
	Name         string
	NameTemplate *template.Template
	Login        string
	Email        string
	Role         string
	Groups       string
	Org          string
}

// String coerces the assertion mapping values to a string-like format
func (am *AssertionMapping) String() string {
	return fmt.Sprintf("name=%s,login=%s,email=%s,role=%s,groups=%s,org=%s", am.Name, am.Login, am.Email, am.Role, am.Groups, am.Org)
}

// Helper function that returns whether SAML assertions are using a template for name;
// If false, it means the `AssertionMapping.Name` property is set
func (am *AssertionMapping) HasNameTemplate() bool {
	return am.NameTemplate != nil
}
