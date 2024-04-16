package validation

import (
	"fmt"
	"strings"

	"github.com/crewjam/saml"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/models/roletype"
	"github.com/grafana/grafana/pkg/services/auth/identity"
	"github.com/grafana/grafana/pkg/services/ssosettings"
	"github.com/grafana/grafana/pkg/util/errutil"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

var (
	ErrInvalidSamlConfig = errutil.ValidationFailed("sso.saml.settings")
	ErrInvalidSAMLConfig = func(msg string) error {
		base := ErrInvalidSamlConfig.Errorf("Invalid SAML settings")
		base.PublicMessage = msg
		return base
	}
	ErrInvalidSAMLConfigEmpty = ErrInvalidSAMLConfig("No SAML configuration was provided")
)

// ValidateSAMLMap validates the SAML settings map before being converted into
// a SAMLInfo struct.
func ValidateSAMLMap(info *map[string]any, requester identity.Requester, validators ...ssosettings.ValidateFunc[map[string]any]) error {
	for _, validatorFunc := range validators {
		if err := validatorFunc(info, requester); err != nil {
			return err
		}
	}
	return nil
}

// ValidateSAMLInfo validates the SAML settings struct before being saved to the
// database.
func ValidateSAMLInfo(info *social.SAMLInfo, requester identity.Requester, validators ...ssosettings.ValidateFunc[social.SAMLInfo]) error {
	for _, validatorFunc := range validators {
		if err := validatorFunc(info, requester); err != nil {
			return err
		}
	}
	return nil
}

// Required only one field needed
// This functions is meant to be used with the required 1 of the SAML setting
// options.
//
// This includes
// - idp_metadata
// - idp_metadata_url
// - idp_metadata_path
// - certificate
// - certificate_path
// - private_key
// - private_key_path
func RequireOnlyOne(value string) ssosettings.ValidateFunc[map[string]any] {
	return func(info *map[string]any, _ identity.Requester) error {
		// Check if info pointer is nil
		if info == nil {
			return ErrInvalidSAMLConfigEmpty
		}
		var count int

		_, valueOk := (*info)[value]
		_, valuePath := (*info)[fmt.Sprintf("%s_path", value)]
		_, valueURL := (*info)[fmt.Sprintf("%s_url", value)]

		if valueOk {
			count++
		}
		if valuePath {
			count++
		}
		if valueURL {
			count++
		}

		if count == 0 {
			return ErrInvalidSAMLConfig(fmt.Sprintf("No value for key `%s` was provided", value))
		}

		if count != 1 {
			return ErrInvalidSAMLConfig(fmt.Sprintf("Too many options have been provided for the `%s` key", value))
		}

		return nil
	}
}

func RequiredIdpMetadata(getIdPMetadata func(cfg *social.SAMLInfo) (*saml.EntityDescriptor, error)) ssosettings.ValidateFunc[social.SAMLInfo] {
	if getIdPMetadata == nil {
		return func(_ *social.SAMLInfo, _ identity.Requester) error {
			return ErrInvalidSAMLConfig("getIdPMetadata function is not provided")
		}
	}
	return func(info *social.SAMLInfo, _ identity.Requester) error {
		_, err := getIdPMetadata(info)
		if err != nil {
			return ErrInvalidSAMLConfig(fmt.Sprintf("Failed to get IdP metadata: %s", err))
		}
		return nil
	}
}

func RequireNoHigherRole() ssosettings.ValidateFunc[map[string]any] {
	return func(info *map[string]any, requester identity.Requester) error {
		if info == nil {
			return ErrInvalidSAMLConfigEmpty
		}

		if requester.GetIsGrafanaAdmin() {
			return nil
		}

		_, ok := (*info)["role_values_grafana_admin"]
		if ok {
			return ErrInvalidSAMLConfig("Changes to Grafana Admin role can only be made by a Grafana Admin")
		}

		caser := cases.Title(language.English)
		for key := range *info {

			role := strings.TrimPrefix(key, "role_values_")
			if role == "admin" {
				return ErrInvalidSAMLConfig("Changes to Admin role 'role_values_grafana_admin' can onle be made by a Grafana Admin")
			}

			if !strings.HasPrefix(key, "role_values_") {
				continue
			}

			roleType := roletype.RoleType(caser.String(role))
			if !roleType.IsValid() {
				return ErrInvalidSAMLConfig(fmt.Sprintf("The role %s cannot be configured", role))
			}

			if !requester.GetOrgRole().Includes(roleType) {
				return ErrInvalidSAMLConfig(fmt.Sprintf("Can't set %s role in key %s", roleType, key))
			}
		}

		if _, ok = (*info)["org_mapping"]; ok {
			return ErrInvalidSAMLConfig("Changes to org mapping can only be performed by a Grafana Admin")
		}

		return nil
	}
}
