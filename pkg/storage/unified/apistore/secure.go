package apistore

import (
	"context"
	"fmt"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secret "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/util"
)

// Mutation hook that will update secure values
func handleSecureValues(ctx context.Context, store secret.InlineSecureValueStore, obj utils.GrafanaMetaAccessor, previousObject utils.GrafanaMetaAccessor) (changed bool, err error) {
	secure, err := obj.GetSecureValues()
	if err != nil {
		return false, err
	}

	if previousObject == nil {
		changed = true
	} else {
		// Merge in any values from the previous object and handle remove
		previous, err := previousObject.GetSecureValues()
		if err != nil {
			return false, err
		}
		if previous != nil && store == nil {
			return false, fmt.Errorf("secure value support is not configured")
		}

		// Keep exactly what we had before
		if len(secure) == 0 {
			return false, obj.SetSecureValues(previous)
		}

		for k, next := range secure {
			last, found := previous[k]
			if found {
				if last.Name == "" {
					return false, fmt.Errorf("invalid state, saved values must always have a name")
				}
				last.Create = next.Create
				last.Remove = next.Remove

				if next.Name != "" && last.Name != next.Name {
					// Add a remove command
					previous["remove_"+util.GenerateShortUID()] = common.InlineSecureValue{
						Name:   last.Name,
						Remove: true,
					}
				}
			} else {
				changed = true
			}
			previous[k] = last
		}

		secure = previous
	}

	owner := utils.ToResourceReference(obj)
	secure, err = store.UpdateSecureValues(ctx, owner, secure)
	if err != nil {
		return false, err
	}
	return changed, obj.SetSecureValues(secure)
}

// Mutation hook that will update secure values
func handleSecureValuesDelete(ctx context.Context, store secret.InlineSecureValueStore, obj utils.GrafanaMetaAccessor) error {
	secure, err := obj.GetSecureValues()
	if err != nil || len(secure) == 0 {
		return err
	}

	if store == nil {
		return fmt.Errorf("secure value support is not configured")
	}

	for k, v := range secure {
		v.Remove = true // Set the remove flag on everything
		secure[k] = v
	}
	_, err = store.UpdateSecureValues(ctx, utils.ToResourceReference(obj), secure)
	if err != nil {
		return err
	}
	return obj.SetSecureValues(nil) // remove them from the object
}
