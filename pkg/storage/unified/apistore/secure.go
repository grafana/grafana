package apistore

import (
	"context"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

type SecureValueStore interface {
	// Check that the request user can reference a secret in the context of a given resource (owner)
	CanReference(ctx context.Context, owner common.ResourceReference, names ...string) (bool, error)

	// Create inline secure value
	CreateSecureValue(ctx context.Context, owner common.ResourceReference, value common.RawSecretValue) (string, error)

	// Called when deleting the referenced values IFF they are owned by the owner
	// for shared values, they are not deleted and no error is returned
	DeleteValuesForOwner(ctx context.Context, owner common.ResourceReference, names ...string) error
}

// Mutation hook that will update secure values
func handleSecureValues(ctx context.Context, store SecureValueStore, obj utils.GrafanaMetaAccessor, previousObject utils.GrafanaMetaAccessor) (changed bool, err error) {
	secure, err := obj.GetSecureValues()
	if err != nil {
		return false, err
	}
	owner := utils.ToResourceReference(obj)

	// Merge in any values from the previous object and handle remove
	if previousObject != nil {
		old, err := previousObject.GetSecureValues()
		if err != nil {
			return false, err
		}
		if old != nil && store == nil {
			return false, fmt.Errorf("secure value support is not configured")
		}
		if len(secure) == 0 {
			secure = old
		} else {
			// Merge old values into the secure section
			for k, oldValue := range old {
				update, found := secure[k]
				if !found {
					secure[k] = oldValue
					continue
				}

				// Explicitly remove the old value
				if update.Remove {
					// Remove the name from the previous saved value
					err := store.DeleteValuesForOwner(ctx, owner, oldValue.Name)
					if err != nil {
						return false, err
					}
					delete(secure, k)
					changed = true
					if err = obj.SetSecureValues(secure); err != nil {
						return changed, err
					}
					continue
				}

				// The name changed (also true for create)
				if oldValue.Name != update.Name {
					// Remove the name from the previous saved value
					err := store.DeleteValuesForOwner(ctx, owner, oldValue.Name)
					if err != nil {
						return false, err
					}
					continue
				}
			}
		}
	}

	// No secure values
	if len(secure) == 0 {
		return changed, nil
	}

	// Process all secure values
	for k, v := range secure {
		if v.Create != "" {
			name, err := store.CreateSecureValue(ctx, owner, v.Create)
			if err != nil {
				return false, err
			}
			secure[k] = common.InlineSecureValue{Name: name}
			changed = true
			continue
		}

		// All secure values must have a reference name
		if v.Name == "" {
			return false, apierrors.NewInvalid(schema.GroupKind{
				Group: owner.Group,
				Kind:  owner.Kind,
			}, owner.Name, field.ErrorList{
				field.NotFound(field.NewPath("secure", k, "name"), v),
			})
		}

		if v.Remove {
			return false, fmt.Errorf("remove command should have already been processed")
		}
	}

	if err = obj.SetSecureValues(secure); err != nil {
		return changed, err
	}

	ok, err := store.CanReference(ctx, owner)
	if err != nil {
		return false, err
	}
	if !ok {
		err = apierrors.NewBadRequest("not allowed to reference secure values")
	}
	return changed, err
}

// Mutation hook that will update secure values
func handleSecureValuesDelete(ctx context.Context, store SecureValueStore, obj utils.GrafanaMetaAccessor) error {
	secure, err := obj.GetSecureValues()
	if err != nil {
		return err
	}

	if secure != nil && store == nil {
		return fmt.Errorf("secure value support is not configured")
	}

	i := 0
	keys := make([]string, len(secure))
	for k := range secure {
		keys[i] = k
		i++
	}
	err = store.DeleteValuesForOwner(ctx, utils.ToResourceReference(obj), keys...)
	if err != nil {
		return err
	}

	return obj.SetSecureValues(nil) // remove them from the object
}
