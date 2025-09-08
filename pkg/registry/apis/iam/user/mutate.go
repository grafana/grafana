package user

import (
	"context"
	"strings"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func MutateOnCreate(ctx context.Context, obj *iamv0alpha1.User) error {
	obj.Spec.Email = strings.ToLower(obj.Spec.Email)
	obj.Spec.Login = strings.ToLower(obj.Spec.Login)

	if obj.Spec.Login == "" {
		obj.Spec.Login = obj.Spec.Email
	}
	if obj.Spec.Email == "" {
		obj.Spec.Email = obj.Spec.Login
	}

	return nil
}
