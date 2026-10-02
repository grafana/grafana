package datasource

import (
	"context"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"

	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var _ builder.APIGroupMutation = (*DataSourceAPIBuilder)(nil)

// Mutate rejects datasource creates that embed Team LBAC rules. The API server
// discovers this hook through APIGroupMutation when it registers the builder.
// Updates require comparing the old and new values so existing rules can be
// echoed without allowing callers to change them.
// See https://github.com/grafana/identity-access-team/issues/2467 for the update guard.
func (b *DataSourceAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	isCreate := a.GetOperation() == admission.Create
	// Admission dispatch is by group/version, which also contains other resources.
	isDatasourceResource := a.GetResource().Resource == b.datasourceResourceInfo.GetName()
	if !isCreate || !isDatasourceResource {
		return nil
	}
	if !openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard, false, openfeature.TransactionContext(ctx)) {
		return nil
	}

	ds, ok := a.GetObject().(*datasourceV0.DataSource)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected DataSource object, got %T", a.GetObject()))
	}

	// Missing, null, or non-object jsonData cannot contain the protected key.
	jsonData, ok := ds.Spec.JSONData().(map[string]any)
	if !ok {
		return nil
	}
	// Even a null or empty value claims the Team LBAC field through this API.
	if _, present := jsonData["teamHttpHeaders"]; present {
		// The legacy create API also rejects any presence of this key, but returns
		// 403. Kubernetes uses 422 here to provide a structured field cause.
		return apierrors.NewInvalid(b.datasourceResourceInfo.GroupVersionKind().GroupKind(), ds.Name, field.ErrorList{
			field.Forbidden(field.NewPath("spec", "jsonData", "teamHttpHeaders"), "manage Team LBAC rules through the TeamLBACRule API"),
		})
	}
	return nil
}
