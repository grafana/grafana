package metadata

import (
	"context"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	secret "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

var _ contracts.InlineSecureValueSupport = (*inlineStorage)(nil)

func ProvideInlineSecureValueSupport(
	db contracts.SecureValueService,
	access authlib.AccessClient,
) (contracts.InlineSecureValueSupport, error) {
	return &inlineStorage{
		db:     db,
		access: access,
	}, nil
}

// TODO! this needs real attention :) and likely explicit support from the DB
// inlineStorage is the actual implementation of the secure value (metadata) storage.
type inlineStorage struct {
	db     contracts.SecureValueService
	access authlib.AccessChecker
}

// CreateInline implements contracts.InlineSecureValueSupport.
func (i *inlineStorage) CreateInline(ctx context.Context, owner common.ObjectReference, value common.RawSecureValue) (string, error) {
	actor, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return "", apierrors.NewBadRequest("missing auth info")
	}
	if owner.Name == "" {
		return "", apierrors.NewBadRequest("missing owner name")
	}
	if value.IsZero() {
		return "", apierrors.NewBadRequest("missing value")
	}

	v, err := i.db.Create(ctx, &secret.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Namespace:       owner.Namespace,
			OwnerReferences: []metav1.OwnerReference{owner.ToOwnerReference()},
		},
	}, actor.GetUID())
	if err != nil {
		return "", err
	}
	return v.Name, nil
}

// DeleteInline implements contracts.InlineSecureValueSupport.
func (i *inlineStorage) DeleteInline(ctx context.Context, owner common.ObjectReference, name string) error {
	_, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return apierrors.NewBadRequest("missing auth info")
	}
	if owner.Name == "" {
		return apierrors.NewBadRequest("missing owner name")
	}

	// TODO, make sure the owner is right!
	_, err := i.db.Delete(ctx, xkube.Namespace(owner.Namespace), name)
	return err
}

// CanReference implements contracts.InlineSecureValueSupport.
func (i *inlineStorage) CanReference(ctx context.Context, owner common.ObjectReference, values common.InlineSecureValues) error {
	actor, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return apierrors.NewBadRequest("missing auth info")
	}
	if owner.Name == "" {
		return apierrors.NewBadRequest("missing owner name")
	}

	// TODO? more efficient version of this based on database query?
	// We want to check if the owner matches OR the identity in context have view permissions
	for _, value := range values {
		if !value.Create.IsZero() {
			return apierrors.NewBadRequest("unable to create")
		}
		if value.Remove {
			return apierrors.NewBadRequest("unable to remove")
		}
		if value.Name == "" {
			return apierrors.NewBadRequest("expecting a name")
		}

		// ???? Read requires view?  do we have a read that does not require view
		v, err := i.db.Read(ctx, xkube.Namespace(owner.Namespace), value.Name)
		if err != nil || v == nil {
			return apierrors.NewBadRequest("unable to reference secure value")
		}

		// for _, ref := range v.OwnerReferences {
		// 	fmt.Printf("REF: %+v\n", ref)
		// }

		// If the owner does not match... check if the request can read the name
		ok, err := i.access.Check(ctx, actor, authlib.CheckRequest{
			Verb:      utils.VerbGet,
			Namespace: owner.Namespace,
			Group:     secret.SchemeGroupVersion.Group,
			Resource:  secret.SecureValuesResourceInfo.GroupResource().Resource,
			Name:      value.Name,
		})
		if err != nil || !ok.Allowed {
			return apierrors.NewBadRequest("not allowed to read value")
		}
	}

	return nil // Yes, can reference
}
