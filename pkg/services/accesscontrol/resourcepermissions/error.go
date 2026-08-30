package resourcepermissions

import (
	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

const (
	invalidPermissionMessage = `Permission [{{ .Public.permission }}] is invalid for this resource type`
	invalidAssignmentMessage = `Assignment [{{ .Public.assignment }}] is invalid for this resource type`
	invalidParamMessage      = `Param [{{ .Public.param }}] is invalid`
	invalidRequestBody       = `Request body is invalid: {{ .Public.reason }}`
	invalidResourceIDMessage = `Resource ID [{{ .Public.resourceID }}] is not valid: wildcard "*" is not allowed`
)

var (
	ErrInvalidParam = errutil.BadRequest("resourcePermissions.invalidParam").
			MustTemplate(invalidParamMessage, errutil.WithPublic(invalidParamMessage))
	ErrInvalidRequestBody = errutil.BadRequest("resourcePermissions.invalidRequestBody").
				MustTemplate(invalidRequestBody, errutil.WithPublic(invalidRequestBody))
	ErrInvalidPermission = errutil.BadRequest("resourcePermissions.invalidPermission").
				MustTemplate(invalidPermissionMessage, errutil.WithPublic(invalidPermissionMessage))
	ErrInvalidAssignment = errutil.BadRequest("resourcePermissions.invalidAssignment").
				MustTemplate(invalidAssignmentMessage, errutil.WithPublic(invalidAssignmentMessage))
	ErrInvalidResourceID = errutil.BadRequest("resourcePermissions.invalidResourceID").
				MustTemplate(invalidResourceIDMessage, errutil.WithPublic(invalidResourceIDMessage))
	ErrExternalTeamMember = errutil.BadRequest("resourcePermissions.externalTeamMember",
		errutil.WithPublicMessage("Cannot modify permission of externally-synced team member"))
)

func ErrInvalidParamData(param string, err error) errutil.TemplateData {
	return errutil.TemplateData{
		Public: map[string]any{
			"param": param,
		},
		Error: err,
	}
}

func ErrInvalidRequestBodyData(reason string) errutil.TemplateData {
	return errutil.TemplateData{
		Public: map[string]any{
			"reason": reason,
		},
	}
}

func ErrInvalidPermissionData(permission string) errutil.TemplateData {
	return errutil.TemplateData{
		Public: map[string]any{
			"permission": permission,
		},
	}
}

func ErrInvalidAssignmentData(assignment string) errutil.TemplateData {
	return errutil.TemplateData{
		Public: map[string]any{
			"assignment": assignment,
		},
	}
}

func ErrInvalidResourceIDData(resourceID string) errutil.TemplateData {
	return errutil.TemplateData{
		Public: map[string]any{
			"resourceID": resourceID,
		},
	}
}
