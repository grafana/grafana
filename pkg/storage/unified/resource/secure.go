package resource

import (
	"context"
	"net/http"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secrets "github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// The "CanReference" check exists to avoid writing references to secrets
// the user should not allow granting access.  We only check it when the value changes
func canReferenceSecureValues(ctx context.Context,
	obj utils.GrafanaMetaAccessor,
	old utils.GrafanaMetaAccessor,
	secrets secrets.InlineSecureValueSupport,
) *resourcepb.ErrorResult {
	secure, err := obj.GetSecureValues()
	if err != nil || len(secure) == 0 {
		return AsErrorResult(err)
	}

	if secrets == nil {
		return &resourcepb.ErrorResult{
			Message: "secure storage not configured",
			Code:    http.StatusServiceUnavailable,
			Reason:  string(metav1.StatusReasonServiceUnavailable),
		}
	}

	// All references should only set a name
	names := make([]string, 0, len(secure))
	for k, v := range secure {
		if !v.Create.IsZero() {
			return newInvalidFieldError(obj,
				"unable to create values in unified storage",
				"secure", k, "create")
		}
		if v.Remove {
			return newInvalidFieldError(obj,
				"unable to save the remove command",
				"secure", k, "remove")
		}
		if v.Name == "" {
			return newRequiredFieldError(obj,
				"missing name",
				"secure", k, "name")
		}
		if !slices.Contains(names, v.Name) {
			names = append(names, v.Name) // unique names
		}
	}

	// This will call the real service to check access, converting any errors to protobuf
	canReference := func() *resourcepb.ErrorResult {
		if err := secrets.CanReference(ctx, utils.ToObjectReference(obj), names...); err != nil {
			return AsErrorResult(err)
		}
		return nil
	}

	// Always check for create
	if old == nil {
		return canReference()
	}

	oldSecureValues, err := old.GetSecureValues()
	if err != nil {
		return AsErrorResult(err)
	}
	if len(secure) != len(oldSecureValues) {
		return canReference()
	}
	for k, v := range secure {
		if oldSecureValues[k].Name != v.Name {
			return canReference()
		}
	}
	return nil // no need to check if the values are the same
}
