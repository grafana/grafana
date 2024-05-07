package resourcepermissions

import (
	"github.com/grafana/grafana/pkg/util/errutil"
)

const (
	invalidPermissionMessage = `Permission [{{ .Public.permission }}] is invalid for this resource type`
	invalidAssignmentMessage = `Assignment [{{ .Public.assignment }}] is invalid for this resource type`
	invalidParamMessage      = `Param [{{ .Public.param }}] is invalid`
	invalidRequestBody       = `Request body is invalid: {{ .Public.reason }}`
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
