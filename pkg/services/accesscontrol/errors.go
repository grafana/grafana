package accesscontrol

import (
	"errors"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
)

const (
	invalidBuiltInRoleMessage       = `built-in role [{{ .Public.builtInRole }}] is not valid`
	assignmentEntityNotFoundMessage = `{{ .Public.assignment }} not found`
)

var (
	ErrInvalidBuiltinRole = errutil.BadRequest("accesscontrol.invalidBuiltInRole").
				MustTemplate(invalidBuiltInRoleMessage, errutil.WithPublic(invalidBuiltInRoleMessage))
	ErrNoneRoleAssignment       = errutil.BadRequest("accesscontrol.noneRoleAssignment", errutil.WithPublicMessage("none role cannot receive permissions"))
	ErrAssignmentEntityNotFound = errutil.BadRequest("accesscontrol.assignmentEntityNotFound").
					MustTemplate(assignmentEntityNotFoundMessage, errutil.WithPublic(assignmentEntityNotFoundMessage))

	// Note: these are intended to be replaced by equivalent errutil implementations.
	// Avoid creating new errors with errors.New and prefer errutil
	ErrInvalidRequestBody     = errutil.BadRequest("accesscontrol.invalidRequestBody", errutil.WithPublicMessage("invalid request body"))
	ErrInvalidRequest         = errutil.BadRequest("accesscontrol.invalidRequest", errutil.WithPublicMessage("invalid request"))
	ErrFixedRolePrefixMissing = errors.New("fixed role should be prefixed with '" + FixedRolePrefix + "'")
	ErrInvalidScope           = errors.New("invalid scope")
	ErrResolverNotFound       = errors.New("no resolver found")
	ErrPluginIDRequired       = errors.New("plugin ID is required")
	ErrRoleNotFound           = errors.New("role not found")

	ErrActionSetValidationFailed = errutil.ValidationFailed("accesscontrol.actionSetInvalid")
)

func ErrInvalidBuiltinRoleData(builtInRole string) errutil.TemplateData {
	return errutil.TemplateData{
		Public: map[string]any{
			"builtInRole": builtInRole,
		},
	}
}

func ErrAssignmentEntityNotFoundData(assignment string) errutil.TemplateData {
	return errutil.TemplateData{
		Public: map[string]any{
			"assignment": assignment,
		},
	}
}

type ErrorInvalidRole struct{}

func (e *ErrorInvalidRole) Error() string {
	return "role is invalid"
}

type ErrorRoleNameMissing struct{}

func (e *ErrorRoleNameMissing) Error() string {
	return "role has been defined without a name"
}

func (e *ErrorRoleNameMissing) Unwrap() error {
	return &ErrorInvalidRole{}
}

type ErrorRolePrefixMissing struct {
	Role     string
	Prefixes []string
}

func (e *ErrorRolePrefixMissing) Error() string {
	return fmt.Sprintf("expected role '%s' to be prefixed with any of '%v'", e.Role, e.Prefixes)
}

func (e *ErrorRolePrefixMissing) Unwrap() error {
	return &ErrorInvalidRole{}
}

type ErrorActionPrefixMissing struct {
	Action   string
	Prefixes []string
}

func (e *ErrorActionPrefixMissing) Error() string {
	return fmt.Sprintf("expected action '%s' to be prefixed with any of '%v'", e.Action, e.Prefixes)
}

func (e *ErrorActionPrefixMissing) Unwrap() error {
	return &ErrorInvalidRole{}
}

type ErrorScopeTarget struct {
	Action        string
	Scope         string
	ExpectedScope string
}

func (e *ErrorScopeTarget) Error() string {
	return fmt.Sprintf("expected action '%s' to be scoped with '%v', found '%v'", e.Action, e.ExpectedScope, e.Scope)
}

func (e *ErrorScopeTarget) Unwrap() error {
	return &ErrorInvalidRole{}
}
