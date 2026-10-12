package authinfo

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apiserver/pkg/registry/rest"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
)

func ValidateOnCreate(ctx context.Context, obj *iamv0alpha1.AuthInfo, userGetter rest.Getter) error {
	if _, err := identity.GetRequester(ctx); err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	if userGetter == nil {
		return nil
	}

	if _, err := userGetter.Get(ctx, obj.Spec.UserRef.Name, &metav1.GetOptions{}); err != nil {
		if apierrors.IsNotFound(err) {
			return apierrors.NewBadRequest("user does not exist")
		}
		return err
	}

	return nil
}

func ValidateOnUpdate(ctx context.Context, obj, old *iamv0alpha1.AuthInfo) error {
	if _, err := identity.GetRequester(ctx); err != nil {
		return apierrors.NewUnauthorized("no identity found")
	}

	if obj.Spec.UserRef.Name != old.Spec.UserRef.Name || obj.Spec.AuthModule != old.Spec.AuthModule {
		return apierrors.NewBadRequest("spec.userRef.name and spec.authModule are immutable")
	}

	return nil
}
