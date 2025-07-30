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
func handleSecureValues(ctx context.Context, store secret.InlineSecureValueSupport, obj utils.GrafanaMetaAccessor, previousObject utils.GrafanaMetaAccessor) (changed bool, err error) {
	secure, err := obj.GetSecureValues()
	if err != nil {
		return false, err
	}

	if previousObject == nil {
		if len(secure) == 0 {
			return false, nil // create
		}
		if store == nil {
			return false, fmt.Errorf("secure value support is not configured (create)")
		}
		changed = true
	} else {
		// Merge in any values from the previous object and handle remove
		previous, err := previousObject.GetSecureValues()
		if err != nil {
			return false, err
		}
		if len(previous) > 0 && store == nil {
			return false, fmt.Errorf("secure value support is not configured (update)")
		}

		// Keep exactly what we had before
		if len(secure) == 0 {
			if len(previous) > 0 {
				return false, obj.SetSecureValues(previous)
			}
			return false, nil
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
	}

	// TODO!!!
	// owner := utils.ToObjectReference(obj)
	// secure, err = store.UpdateSecureValues(ctx, owner, secure)
	// if err != nil {
	// 	return false, err
	// }
	// TODO: calculate change from the response
	return changed, obj.SetSecureValues(secure)
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
		if err = store.DeleteInline(ctx, owner, v.Name); err != nil {
			return err
		}
	}
	return obj.SetSecureValues(nil) // remove them from the object
}
