package metadata

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	authlib "github.com/grafana/authlib/types"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
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
func (i *inlineStorage) CanReference(ctx context.Context, owner common.ResourceReference, values common.InlineSecureValues) (bool, error) {
	actor, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return false, apierrors.NewBadRequest("missing auth info")
	}
	if owner.Name == "" {
		return false, apierrors.NewBadRequest("missing owner name")
	}

	// TODO? more efficient version of this based on database query?
	// We want to check if the owner matches OR the identity in context have view permissions
	for _, value := range values {
		if !value.Create.IsZero() {
			return false, apierrors.NewBadRequest("unable to create")
		}
		if value.Remove {
			return false, apierrors.NewBadRequest("unable to remove")
		}
		if value.Name == "" {
			return false, apierrors.NewBadRequest("expecting a name")
		}

		// ???? Read requires view?  do we have a read that does not require view
		v, err := i.db.Read(ctx, xkube.Namespace(owner.Namespace), value.Name, contracts.ReadOpts{})
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
			Name:      value.Name,
		})
		if err != nil || !ok.Allowed {
			return false, apierrors.NewBadRequest("not allowed to read value")
		}
	}

	return true, nil
}

// UpdateSecureValues implements contracts.InlineSecureValueStore.
func (i *inlineStorage) UpdateSecureValues(ctx context.Context, owner common.ResourceReference, values common.InlineSecureValues) (common.InlineSecureValues, error) {
	actor, ok := authlib.AuthInfoFrom(ctx)
	if !ok {
		return nil, apierrors.NewBadRequest("missing auth info")
	}

	keep := make(common.InlineSecureValues, len(values))
	for key, secure := range values {
		var prev *secret.SecureValue
		if secure.Name != "" {
			// The user may not be able to read the value if it is owned
			prev, _ = i.db.Read(ctx, xkube.Namespace(owner.Namespace), secure.Name, contracts.ReadOpts{})
			if prev == nil {
				if secure.Remove {
					continue // OK if not found
				}
				if secure.Create.IsZero() {
					return nil, apierrors.NewInvalid(schema.GroupKind{}, "", field.ErrorList{
						field.Invalid(field.NewPath("secure", key, "name"),
							secure.Name, "Unable to read secure value")})
				}
				secure.Name = "" // previous value not found
			}
		}

		if secure.Remove {
			if prev != nil {
				// TODO... only if owned by the owner
				if err := i.db.Delete(ctx, xkube.Namespace(owner.Namespace), prev.Name); err != nil {
					return nil, err
				}
			}
			continue
		}

		if !secure.Create.IsZero() {
			if prev != nil {
				// TODO: CHECK if the value has actually changed
				fmt.Printf("TODO... check if value has changed %+v\n", prev)
			}
			v, err := i.db.Create(ctx, &secret.SecureValue{
				ObjectMeta: v1.ObjectMeta{
					OwnerReferences: []v1.OwnerReference{owner.ToOwnerReference()},
				},
			}, actor.GetUID())
			if err != nil {
				return nil, err
			}
			secure = common.InlineSecureValue{Name: v.Name}
		}

		keep[key] = secure
	}

	// TODO? clean up any orphan secure values?

	return keep, nil
}
