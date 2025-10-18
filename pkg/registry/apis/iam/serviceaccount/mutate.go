package serviceaccount

import (
	"context"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func MutateOnCreate(ctx context.Context, obj *iamv0alpha1.ServiceAccount) error {
	// External service accounts have None org role by default
	if obj.Spec.Plugin != "" && obj.Spec.Role == "" {
		obj.Spec.Role = iamv0alpha1.ServiceAccountOrgRoleNone
	}

	return nil
}
