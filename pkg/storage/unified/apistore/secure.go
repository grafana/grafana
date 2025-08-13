package apistore

import (
	"context"
	"fmt"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
)

// prepareSecureValues will create any new secure values and register changes inside the provided objectForStorage
// any call to this function MUST be followed by a call to info.finish(ctx, nil, store) to ensure that the secure values are cleaned up
//
// nolint:gocyclo
func prepareSecureValues(ctx context.Context, store secret.InlineSecureValueSupport, obj utils.GrafanaMetaAccessor, previousObject utils.GrafanaMetaAccessor, v *objectForStorage) (err error) {
	secure, err := obj.GetSecureValues()
	if err != nil {
		return err
	}

	// Owner reference for inline values
	v.ref = utils.ToObjectReference(obj)

	var previous common.InlineSecureValues
	if previousObject == nil {
		if len(secure) == 0 {
			return nil // create
		}
		if store == nil {
			return fmt.Errorf("secure value support is not configured (create)")
		}
		previous = make(common.InlineSecureValues, 0)
	} else {
		// Merge in any values from the previous object and handle remove
		previous, err = previousObject.GetSecureValues()
		if err != nil {
			return err
		}
		for _, p := range previous {
			if p.Name == "" || p.Remove || !p.Create.IsZero() {
				return fmt.Errorf("invalid state, saved values must always have a name")
			}
		}

		// Keep exactly what we had before
		if len(secure) == 0 {
			if len(previous) > 0 {
				return obj.SetSecureValues(previous)
			}
			return nil
		}

		if store == nil {
			return fmt.Errorf("secure value support is not configured (update)")
		}
	}

	for k, val := range secure {
		before := previous[k]
		if val.Name == "" {
			if before.Name != "" {
				v.deleteSecureValues = append(v.deleteSecureValues, before.Name)
				delete(previous, k)
			}
			if val.Remove {
				if before.Name == "" {
					return fmt.Errorf("cannot remove secure value '%s', it did not exist in the previous value", k)
				}
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
				secure[k] = common.InlineSecureValue{Name: n}
				continue
			}
			return fmt.Errorf("invalid secure value state: %s", k)
		}

		// The name changed from the previously stored value
		if before.Name != "" && before.Name != val.Name {
			// This can happen when explicitly shifting from an inline value to a shared secret
			v.deleteSecureValues = append(v.deleteSecureValues, before.Name)
			v.hasChanged = true
		}

		delete(previous, k)
	}

	// Keep all previous values that were not referenced in the update
	for k, v := range previous {
		_, found := secure[k]
		if !found {
			secure[k] = v // the previous value
		}
	}

	// Make sure the deleted list is unique and does not contain any referenced values
	if len(v.deleteSecureValues) > 0 && len(secure) > 0 {
		confirm := v.deleteSecureValues
		v.deleteSecureValues = make([]string, 0, len(v.deleteSecureValues))
		used := make(map[string]bool, len(secure))
		for _, v := range secure {
			used[v.Name] = true
		}
		for _, name := range confirm {
			if _, ok := used[name]; ok {
				continue
			}
			used[name] = true
			v.deleteSecureValues = append(v.deleteSecureValues, name)
		}
	}

	if len(v.deleteSecureValues) > 0 || len(v.createdSecureValues) > 0 {
		v.hasChanged = true
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
