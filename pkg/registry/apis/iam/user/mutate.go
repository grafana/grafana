package user

import (
	"context"
	"strings"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"golang.org/x/text/cases"
	"golang.org/x/text/language"
)

func MutateOnCreateAndUpdate(ctx context.Context, obj *iamv0alpha1.User) error {
	obj.Spec.Email = strings.ToLower(obj.Spec.Email)
	obj.Spec.Login = strings.ToLower(obj.Spec.Login)

	if obj.Spec.Login == "" {
		obj.Spec.Login = obj.Spec.Email
	}

	obj.Spec.Role = cases.Title(language.Und).String(obj.Spec.Role)

	return nil
}
