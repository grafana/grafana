package datasource

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/datasources"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
)

// Validate implements builder.APIGroupValidation
func (b *DataSourceAPIBuilder) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	obj := a.GetObject()
	if obj == nil {
		return nil
	}

	ds, ok := obj.(*datasourceV0.DataSource)
	if !ok {
		return nil // Not a datasource, skip
	}

	switch a.GetOperation() {
	case admission.Create, admission.Update:
		return b.validateDataSource(ctx, ds)
	}
	return nil
}

func (b *DataSourceAPIBuilder) validateDataSource(ctx context.Context, ds *datasourceV0.DataSource) error {
	if b.configProvider == nil {
		return nil
	}

	cfg, err := b.configProvider.Get(ctx)
	if err != nil {
		return err
	}

	// Auth proxy header validation (CVE-2022-35957)
	if cfg != nil && cfg.AuthProxy.Enabled {
		if jsonData, ok := ds.Spec.JSONData().(map[string]any); ok {
			if err := validateAuthProxyHeader(jsonData, cfg.AuthProxy.HeaderName); err != nil {
				return apierrors.NewInvalid(
					ds.GroupVersionKind().GroupKind(),
					ds.Name,
					field.ErrorList{
						field.Forbidden(field.NewPath("spec", "jsonData"), err.Error()),
					})
			}
		}
	}
	return nil
}

// validateAuthProxyHeader checks that datasource custom headers don't match
// the auth proxy header name (CVE-2022-35957).
func validateAuthProxyHeader(jsonData map[string]any, authProxyHeaderName string) error {
	for key, value := range jsonData {
		if strings.HasPrefix(key, datasources.CustomHeaderName) {
			header := fmt.Sprint(value)
			if http.CanonicalHeaderKey(header) == http.CanonicalHeaderKey(authProxyHeaderName) {
				return errors.New("forbidden to add a data source header with a name equal to auth proxy header name")
			}
		}
	}
	return nil
}
