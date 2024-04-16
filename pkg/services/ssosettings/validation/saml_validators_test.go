package validation

import (
	"errors"
	"testing"

	"github.com/crewjam/saml"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/assert"
)

func TestValidateSAMLMap(t *testing.T) {
	configuration := map[string]any{}
	testCases := []struct {
		name      string
		functions []ssosettings.ValidateFunc[map[string]any]
		error     error
	}{
		{
			name: "should not return error with no validator functions",
		},
		{
			name: "should not return error when running a successul validation function",
			functions: []ssosettings.ValidateFunc[map[string]any]{
				func(configuration *map[string]any, requester identity.Requester) error {
					return nil
				},
			},
		},
		{
			name: "should return error when running a failed validation function",
			functions: []ssosettings.ValidateFunc[map[string]any]{
				func(configuration *map[string]any, requester identity.Requester) error {
					return ErrInvalidSAMLConfig("error")
				},
			},
			error: ErrInvalidSAMLConfig("error"),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.error, ValidateSAMLMap(&configuration, nil, tc.functions...))
		})
	}
}

func TestValidateSAMLInfo(t *testing.T) {
	configuration := &social.SAMLInfo{}
	testCases := []struct {
		name      string
		functions []ssosettings.ValidateFunc[social.SAMLInfo]
		error     error
	}{
		{
			name: "should not return error with no validator functions",
		},
		{
			name: "should not return error when running a successul validation function",
			functions: []ssosettings.ValidateFunc[social.SAMLInfo]{
				func(configuration *social.SAMLInfo, requester identity.Requester) error {
					return nil
				},
			},
		},
		{
			name: "should return error when running a failed validation function",
			functions: []ssosettings.ValidateFunc[social.SAMLInfo]{
				func(configuration *social.SAMLInfo, requester identity.Requester) error {
					return ErrInvalidSAMLConfig("error")
				},
			},
			error: ErrInvalidSAMLConfig("error"),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.error, ValidateSAMLInfo(configuration, nil, tc.functions...))
		})
	}
}

func TestRequireOnlyOne(t *testing.T) {
	testCases := []struct {
		name          string
		configuration map[string]any
		key           string
		error         error
	}{
		{
			name:  "should return error when no value is provided",
			key:   "idp_metadata",
			error: ErrInvalidSAMLConfig("No value for key `idp_metadata` was provided"),
		},
		{
			name: "should return error when multiple values are provided",
			key:  "idp_metadata",
			configuration: map[string]any{
				"idp_metadata":      "value",
				"idp_metadata_path": "value",
			},
			error: ErrInvalidSAMLConfig("Too many options have been provided for the `idp_metadata` key"),
		},
		{
			name: "should not return error when only one value is provided",
			key:  "idp_metadata",
			configuration: map[string]any{
				"idp_metadata": "value",
			},
		},
		{
			name: "should not return error when only one value path is provided",
			key:  "idp_metadata",
			configuration: map[string]any{
				"idp_metadata_path": "value",
			},
		},
		{
			name: "should not return error when only one value url is provided",
			key:  "idp_metadata",
			configuration: map[string]any{
				"idp_metadata_url": "value",
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateSAMLMap(&tc.configuration, nil, RequireOnlyOne(tc.key))
			assert.Equal(t, tc.error, err)
		})
	}
}

func TestRequireOnlyOneEmptyMap(t *testing.T) {
	err := ValidateSAMLMap(nil, nil, RequireOnlyOne("idp_metadata"))
	assert.Equal(t, ErrInvalidSAMLConfigEmpty, err)
}

func TestRequiredIdpMetadata(t *testing.T) {
	testCases := []struct {
		name          string
		configuration social.SAMLInfo
		key           string
		err           error
		mockFunction  func(cfg *social.SAMLInfo) (*saml.EntityDescriptor, error)
	}{
		{
			name:         "should return error when idp metadata function is not found",
			mockFunction: nil,
			err:          ErrInvalidSAMLConfig("getIdPMetadata function is not provided"),
		},
		{
			name: "should return error when idp metadata function returns an error",
			mockFunction: func(cfg *social.SAMLInfo) (*saml.EntityDescriptor, error) {
				return nil, errors.New("random error")
			},
			err: ErrInvalidSAMLConfig("Failed to get IdP metadata: random error"),
		},
		{
			name: "should not return error when idp metadata function returns no error",
			mockFunction: func(cfg *social.SAMLInfo) (*saml.EntityDescriptor, error) {
				return &saml.EntityDescriptor{}, nil
			},
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := ValidateSAMLInfo(&tc.configuration, nil, RequiredIdpMetadata(tc.mockFunction))
			assert.Equal(t, tc.err, err)
		})
	}
}

func TestRequireNoHigherRole(t *testing.T) {
	testCases := []struct {
		name          string
		requester     identity.Requester
		configuration map[string]any
		key           string
		err           error
	}{
		{
			name: "should not return error when the requester is a Grafana Admin",
			requester: &user.SignedInUser{
				IsGrafanaAdmin: true,
			},
		},
		{
			name: "should return error when requesting to change the Grafana Admin Role",
			configuration: map[string]any{
				"role_values_grafana_admin": "editor",
			},
			err: ErrInvalidSAMLConfig("Changes to Grafana Admin role can only be made by a Grafana Admin"),
		},
		{
			name: "should ignore configuration keys that don't start with role_values_",
			configuration: map[string]any{
				"roles_values_grafana_admin": "editor",
				"enable":                     true,
				"idp_metadata":               "value",
				"max_auth_age":               3600,
			},
		},
		{
			name: "should return error when requesting to change the Admin Role",
			configuration: map[string]any{
				"role_values_admin": "editor",
			},
			err: ErrInvalidSAMLConfig("Changes to Admin role 'role_values_grafana_admin' can onle be made by a Grafana Admin"),
		},
		{
			name: "should return error when trying to configure a non-valid role",
			configuration: map[string]any{
				"role_values_random": "editor",
			},
			err: ErrInvalidSAMLConfig("The role random cannot be configured"),
		},
		{
			name: "should fail when setting a role higher than the requester",
			requester: &user.SignedInUser{
				OrgRole: roletype.RoleViewer,
			},
			configuration: map[string]any{
				"role_values_editor": "admin",
			},
			err: ErrInvalidSAMLConfig("Can't set Editor role in key role_values_editor"),
		},
		{
			name: "should not return error when setting a role lower than the requester",
			requester: &user.SignedInUser{
				OrgRole: roletype.RoleEditor,
			},
			configuration: map[string]any{
				"role_values_viewer": "editor",
			},
		},
		{
			name: "",
			requester: &user.SignedInUser{
				OrgRole: roletype.RoleAdmin,
			},
			configuration: map[string]any{
				"org_mapping": "*:*:Admin",
			},
			err: ErrInvalidSAMLConfig("Changes to org mapping can only be performed by a Grafana Admin"),
		},
	}
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			if tc.requester == nil {
				tc.requester = &user.SignedInUser{}
			}
			err := ValidateSAMLMap(&tc.configuration, tc.requester, RequireNoHigherRole())
			assert.Equal(t, tc.err, err)
		})
	}
}

func TestRequireNoHigherRoleEmptyMap(t *testing.T) {
	err := ValidateSAMLMap(nil, nil, RequireNoHigherRole())
	assert.Equal(t, ErrInvalidSAMLConfigEmpty, err)
}
