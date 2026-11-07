package apistore

import (
	"context"
	"fmt"
	"maps"
	"strings"

	authlib "github.com/grafana/authlib/types"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/storage/unified/apistore/securevalue"
)

// This prefix is used when modeling datasources from legacy SQL + secrets
// We must not use the same name when saving in unified storage
// If we try to save a secure value with this name, it will error
const LEGACY_DATASOURCE_SECURE_VALUE_NAME_PREFIX = "lds-sv-"

// prepareSecureValues will create any new secure values and register changes inside the provided objectForStorage
// any call to this function MUST be followed by a call to info.finish(ctx, nil, store) to ensure that the secure values are cleaned up
func prepareSecureValues(ctx context.Context, store secret.InlineSecureValueSupport, obj utils.GrafanaMetaAccessor, previousObject utils.GrafanaMetaAccessor, owner common.ObjectReference, v *objectForStorage) (err error) {
	secure, err := obj.GetSecureValues()
	if err != nil {
		return err
	}

	v.ref = owner

	var previous common.InlineSecureValues
	var stored common.InlineSecureValues // the references saved before this write; previous is changed below
	if previousObject == nil {
		if len(secure) == 0 {
			return nil // nothing needs to change
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
				return fmt.Errorf("invalid state, saved values must only have a name")
			}
		}
		stored = maps.Clone(previous)

		// Keep exactly what we had before
		if len(secure) == 0 {
			if len(previous) > 0 {
				// Kept references still need checking: the writer may not be allowed to change this object
				if err := verifyDynamicSecureValues(ctx, store, obj, stored, owner, previous); err != nil {
					return err
				}
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
			if before.Name != "" { // implicitly delete previous secure value if the same field no longer references it
				if !secret.IsDynamicSecureValueName(before.Name) {
					v.deleteSecureValues = append(v.deleteSecureValues, before.Name)
				}
				delete(previous, k)
			}
			if !val.Create.IsZero() {
				if val.Remove {
					return newSecureValueError("only one of create, or remove is allowed", k)
				}
				n, err := store.CreateInline(ctx, v.ref, val.Create, val.Description)
				if err != nil {
					return err
				}
				v.createdSecureValues = append(v.createdSecureValues, n)
				v.hasChanged = true
				secure[k] = common.InlineSecureValue{Name: n}

				// Avoid exposing a raw secret in the kubectl metadata
				obj.SetAnnotation(utils.AnnoKeyKubectlLastAppliedConfig, "")
				continue
			}
			if val.Remove {
				delete(secure, k)
				if before.Name == "" {
					continue // no-op
				}
				v.hasChanged = true
				continue
			}
			return newSecureValueError("invalid secure value state: %s", k)
		}

		if !val.Create.IsZero() || val.Remove {
			return newSecureValueError("only one of name, create, or remove is allowed", k)
		}

		// The name changed from the previously stored value
		if before.Name != "" && before.Name != val.Name {
			// This can happen when explicitly shifting from an inline value to a shared secret
			if !secret.IsDynamicSecureValueName(before.Name) {
				v.deleteSecureValues = append(v.deleteSecureValues, before.Name)
			}
			v.hasChanged = true
		}

		if strings.HasPrefix(val.Name, LEGACY_DATASOURCE_SECURE_VALUE_NAME_PREFIX) {
			return newSecureValueError("unable to save secure value reference with legacy datasource prefix", k)
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

	// Check the merged result, so references kept from the previous object are checked too
	if err := verifyDynamicSecureValues(ctx, store, obj, stored, owner, secure); err != nil {
		return err
	}

	return cleanupSecureValues(v, obj, secure)
}

// verifyDynamicSecureValues checks an object that holds, or held before this write, a dynamic
// secure value. Such an object must be managed by grafana cloud without allowing edits, and only
// grafana cloud may write it. Each dynamic value must also pass CanReference with the same owner
// used for inline secure values, so shared storage groups match.
func verifyDynamicSecureValues(ctx context.Context, store secret.InlineSecureValueSupport, obj utils.GrafanaMetaAccessor, stored common.InlineSecureValues, owner common.ObjectReference, secure common.InlineSecureValues) error {
	auth, ok := authlib.AuthInfoFrom(ctx)
	// TODO: any access policy in the namespace passes. Restrict this to the grafana cloud service identity.
	isCloud := ok && auth.GetIdentityType() == authlib.TypeAccessPolicy

	// enforceManagerProperties does not enforce ManagerKindGrafana, so the writer is checked here.
	// This also stops anyone else removing the dynamic value or the manager.
	if !isCloud {
		for k, v := range stored {
			if secret.IsDynamicSecureValueName(v.Name) {
				return newSecureValueError("an object with a dynamic secure value may only be changed by grafana cloud", k)
			}
		}
	}

	for k, v := range secure {
		if !secret.IsDynamicSecureValueName(v.Name) {
			continue
		}
		if store == nil {
			return newSecureValueError("secure value support is not configured (dynamic)", k)
		}
		m, ok := obj.GetManagerProperties()
		if !ok || m.Kind != utils.ManagerKindGrafana || m.Identity != "cloud" || m.AllowsEdits {
			return newSecureValueError("dynamic secure values require a grafana cloud manager that does not allow edits", k)
		}
		if !isCloud {
			return newSecureValueError("dynamic secure values may only be configured by grafana cloud", k)
		}
		if err := store.CanReference(ctx, owner, v.Name); err != nil {
			return err
		}
	}
	return nil
}

// make sure the registered changes are unique and valid
func cleanupSecureValues(v *objectForStorage, obj utils.GrafanaMetaAccessor, secure common.InlineSecureValues) error {
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

// Mutation hook that will delete secure values
func handleSecureValuesDelete(ctx context.Context, store secret.InlineSecureValueSupport, obj utils.GrafanaMetaAccessor, owner common.ObjectReference) error {
	secure, err := obj.GetSecureValues()
	if err != nil || len(secure) == 0 {
		return err
	}

	if store == nil {
		return fmt.Errorf("secure value support is not configured (delete)")
	}

	for _, v := range secure {
		if secret.IsDynamicSecureValueName(v.Name) {
			continue // nothing is stored
		}
		if err = store.DeleteWhenOwnedByResource(ctx, owner, v.Name); err != nil {
			return err
		}
	}
	return obj.SetSecureValues(nil) // remove them from the object
}

func newSecureValueError(msg string, key string) error {
	err := apierrors.NewBadRequest(msg)
	err.ErrStatus.Details = &v1.StatusDetails{
		Causes: []v1.StatusCause{{
			Type:  v1.CauseTypeFieldValueInvalid,
			Field: fmt.Sprintf("secure.%s", key),
		}},
	}
	return err
}
