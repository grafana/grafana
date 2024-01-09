package accesscontrol

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util/errutil"
)

var (
	errAuthorizationGeneric = errutil.Forbidden("alerting.unauthorized")
)

func NewAuthorizationErrorWithPermissions(action string, eval accesscontrol.Evaluator) error {
	msg := fmt.Sprintf("user is not authorized to %s", action)
	err := errAuthorizationGeneric.Errorf(msg)
	err.PublicMessage = msg
	if eval != nil {
		err.PublicPayload = map[string]any{
			"permissions": eval.GoString(),
		}
	}
	return err
}

func NewAuthorizationErrorGeneric(action string) error {
	return NewAuthorizationErrorWithPermissions(action, nil)
}
