package metadata

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

var _ contracts.InlineSecureValueStore = (*inlineStorage)(nil)

func ProvideInlineSecureValueStore(
	db contracts.SecureValueMetadataStorage,
	access authlib.AccessClient,
) (contracts.InlineSecureValueStore, error) {
	return &inlineStorage{
		db:     db,
		access: access,
	}, nil
}

// inlineStorage is the actual implementation of the secure value (metadata) storage.
type inlineStorage struct {
	db     contracts.SecureValueMetadataStorage
	access authlib.AccessChecker
}

// CanReference implements contracts.InlineSecureValueStore.
func (i *inlineStorage) CanReference(ctx context.Context, owner v0alpha1.ResourceReference, names ...string) (bool, error) {
	actor, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return false, apierrors.NewBadRequest("missing auth info")
	}
	if owner.Name == "" {
		return false, apierrors.NewBadRequest("missing owner name")
	}

	// TODO? more efficient version of this based on database query?
	// We want to check if the owner matches OR the identity in context have view permissions
	for _, name := range names {
		// ???? Read requires view?  do we have a read that does not require view
		v, err := i.db.Read(ctx, xkube.Namespace(owner.Namespace), name, contracts.ReadOpts{})
		if err != nil || v == nil {
			return false, apierrors.NewBadRequest("unable to reference secure value")
		}

		for _, ref := range v.OwnerReferences {
			fmt.Printf("REF: %+v\n", ref)
		}

		// If the owner does not match... check if the request can read the name
		ok, err := i.access.Check(ctx, actor, authlib.CheckRequest{
			Verb:      utils.VerbGet,
			Namespace: owner.Namespace,
			Group:     secret.SchemeGroupVersion.Group,
			Resource:  secret.SecureValuesResourceInfo.GroupResource().Resource,
			Name:      name,
		})
		if err != nil || !ok.Allowed {
			return false, apierrors.NewBadRequest("not allowed to read value")
		}
	}

	return true, nil
}

// CreateSecureValue implements contracts.InlineSecureValueStore.
func (i *inlineStorage) CreateSecureValue(ctx context.Context, owner v0alpha1.ResourceReference, value v0alpha1.RawSecretValue) (string, error) {
	actor, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return "", apierrors.NewBadRequest("missing auth info")
	}

	v, err := i.db.Create(ctx, &secret.SecureValue{
		ObjectMeta: v1.ObjectMeta{
			OwnerReferences: []v1.OwnerReference{owner.ToOwnerReference()},
		},
	}, actor.GetUID())
	if err != nil {
		return "", err
	}
	return v.Name, nil
}

// DeleteValuesForOwner implements contracts.InlineSecureValueStore.
func (i *inlineStorage) DeleteValuesForOwner(ctx context.Context, owner v0alpha1.ResourceReference, names ...string) error {
	// TODO!!! ONLY DELETE if the owner matches
	for _, name := range names {
		if err := i.db.Delete(ctx, xkube.Namespace(owner.Namespace), name); err != nil {
			return err
		}
	}
	return nil
}
