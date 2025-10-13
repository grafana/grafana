package validation

import (
	"fmt"
	"net/url"
	"slices"
	"strings"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/login/social"
	"github.com/grafana/grafana/pkg/services/ssosettings"
)

func AllowAssignGrafanaAdminValidator(info *social.OAuthInfo, oldInfo *social.OAuthInfo, requester identity.Requester) ssosettings.ValidateFunc[social.OAuthInfo] {
	return func(info *social.OAuthInfo, requester identity.Requester) error {
		hasChanged := info.AllowAssignGrafanaAdmin != oldInfo.AllowAssignGrafanaAdmin
		if hasChanged && !requester.GetIsGrafanaAdmin() {
			return ssosettings.ErrInvalidOAuthConfig("Allow assign Grafana Admin can only be updated by Grafana Server Admins.")
		}
		return nil
	}
}

func OrgMappingValidator(info *social.OAuthInfo, oldInfo *social.OAuthInfo, requester identity.Requester) ssosettings.ValidateFunc[social.OAuthInfo] {
	return func(info *social.OAuthInfo, requester identity.Requester) error {
		hasChanged := !slices.Equal(oldInfo.OrgMapping, info.OrgMapping)
		if hasChanged && !requester.GetIsGrafanaAdmin() {
			return ssosettings.ErrInvalidOAuthConfig("Organization mapping can only be updated by Grafana Server Admins.")
		}
		return nil
	}
}

func OrgAttributePathValidator(info *social.OAuthInfo, oldInfo *social.OAuthInfo, requester identity.Requester) ssosettings.ValidateFunc[social.OAuthInfo] {
	return func(info *social.OAuthInfo, requester identity.Requester) error {
		hasChanged := info.OrgAttributePath != oldInfo.OrgAttributePath
		if hasChanged && !requester.GetIsGrafanaAdmin() {
			return ssosettings.ErrInvalidOAuthConfig("Organization attribute path can only be updated by Grafana Server Admins.")
		}
		return nil
	}
}

func SkipOrgRoleSyncAllowAssignGrafanaAdminValidator(info *social.OAuthInfo, requester identity.Requester) error {
	if info.AllowAssignGrafanaAdmin && info.SkipOrgRoleSync {
		return ssosettings.ErrInvalidOAuthConfig("Allow assign Grafana Admin and Skip org role sync are both set thus Grafana Admin role will not be synced. Consider setting one or the other.")
	}
	return nil
}

func RequiredValidator(value string, name string) ssosettings.ValidateFunc[social.OAuthInfo] {
	return func(info *social.OAuthInfo, requester identity.Requester) error {
		if value == "" {
			return ssosettings.ErrInvalidOAuthConfig(fmt.Sprintf("%s is required.", name))
		}
		return nil
	}
}

func UrlValidator(value string, name string) ssosettings.ValidateFunc[social.OAuthInfo] {
	return func(info *social.OAuthInfo, requester identity.Requester) error {
		if !isValidUrl(value) {
			return ssosettings.ErrInvalidOAuthConfig(fmt.Sprintf("%s is an invalid URL.", name))
		}
		return nil
	}
}

func RequiredUrlValidator(value string, name string) ssosettings.ValidateFunc[social.OAuthInfo] {
	return func(info *social.OAuthInfo, requester identity.Requester) error {
		if err := RequiredValidator(value, name)(info, requester); err != nil {
			return err
		}
		return UrlValidator(value, name)(info, requester)
	}
}

func MustBeEmptyValidator(value string, name string) ssosettings.ValidateFunc[social.OAuthInfo] {
	return func(info *social.OAuthInfo, requester identity.Requester) error {
		if value != "" {
			return ssosettings.ErrInvalidOAuthConfig(fmt.Sprintf("%s must be empty.", name))
		}
		return nil
	}
}

func isValidUrl(actual string) bool {
	parsed, err := url.ParseRequestURI(actual)
	if err != nil {
		return false
	}
	return strings.HasPrefix(parsed.Scheme, "http") && parsed.Host != ""
}
