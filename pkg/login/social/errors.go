package social

import (
	"errors"

	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	ErrIDTokenNotFound = errors.New("id_token not found")
	ErrEmailNotFound   = errors.New("error getting user info: no email found in access token")

	errRoleAttributePathNotSet = errutil.BadRequest("oauth.role_attribute_path_not_set",
		errutil.WithPublicMessage("Instance role_attribute_path misconfigured, please contact your administrator"))

	errRoleAttributeStrictViolation = errutil.BadRequest("oauth.role_attribute_strict_violation",
		errutil.WithPublicMessage("IdP did not return a role attribute, please contact your administrator"))

	errInvalidRole = errutil.BadRequest("oauth.invalid_role",
		errutil.WithPublicMessage("IdP did not return a valid role attribute, please contact your administrator"))
)
