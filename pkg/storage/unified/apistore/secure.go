package apistore

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// Mutation hook that will update secure values
func handleSecureValues(ctx context.Context, store secret.InlineSecureValueSupport, obj utils.GrafanaMetaAccessor, previousObject utils.GrafanaMetaAccessor, v *objectForStorage) (err error) {
	secure, err := obj.GetSecureValues()
	if err != nil {
		return err
	}

	// Owner reference for inline values
	v.ref = utils.ToObjectReference(obj)

	existing := make(map[string]bool)
	if previousObject == nil {
		if len(secure) == 0 {
			return nil // create
		}
		if store == nil {
			return fmt.Errorf("secure value support is not configured (create)")
		}
	} else {
		// Merge in any values from the previous object and handle remove
		previous, err := previousObject.GetSecureValues()
		if err != nil {
			return err
		}
		if len(previous) > 0 && store == nil {
			return fmt.Errorf("secure value support is not configured (update)")
		}

		// Keep exactly what we had before
		if len(secure) == 0 {
			if len(previous) > 0 {
				return obj.SetSecureValues(previous)
			}
			return nil
		}

		for _, p := range previous {
			if p.Name == "" {
				return fmt.Errorf("invalid state, saved values must always have a name")
			}
			existing[p.Name] = true
		}
	}

	for k, val := range secure {
		if val.Name == "" {
			if val.Remove {
				delete(secure, k)
				v.hasChanged = true
				continue
			}
			if !val.Create.IsZero() {
				n, err := store.CreateInline(ctx, v.ref, val.Create)
				if err != nil {
					return err
				}
				v.createdSecureValues = append(v.createdSecureValues, n)
				v.hasChanged = true
				secure[k] = v0alpha1.InlineSecureValue{Name: n}
				continue
			}
			return fmt.Errorf("invalid state: %v", v)
		}
		delete(existing, val.Name)
	}

	// Remove any references that no longer exist (after the create|update are successful)
	for k := range existing {
		v.deleteSecureValues = append(v.deleteSecureValues, k)
	}
	return obj.SetSecureValues(secure)
}

// Mutation hook that will update secure values
func handleSecureValuesDelete(ctx context.Context, store secret.InlineSecureValueSupport, obj utils.GrafanaMetaAccessor) error {
	secure, err := obj.GetSecureValues()
	if err != nil || len(secure) == 0 {
		return err
	}

	if store == nil {
		return fmt.Errorf("secure value support is not configured (delete)")
	}

	owner := utils.ToObjectReference(obj)
	for _, v := range secure {
		if err = store.DeleteWhenOwnedByResource(ctx, owner, v.Name); err != nil {
			return err
		}
	}
	return obj.SetSecureValues(nil) // remove them from the object
}
