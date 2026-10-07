package datasource

import (
	"context"
	"fmt"
	"maps"
	"reflect"

	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
)

var _ builder.APIGroupValidation = (*DataSourceAPIBuilder)(nil)
var _ builder.APIGroupMutation = (*DataSourceAPIBuilder)(nil)

// Validate rejects datasource creates that embed Team LBAC rules. The API server
// discovers this hook through APIGroupValidation when it registers the builder.
func (b *DataSourceAPIBuilder) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	isCreate := a.GetOperation() == admission.Create
	// Admission dispatch is by group/version, which also contains other resources.
	isDatasourceResource := a.GetResource().Resource == b.datasourceResourceInfo.GetName()
	if !isCreate || !isDatasourceResource {
		return nil
	}
	ds, ok := a.GetObject().(*datasourceV0.DataSource)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected DataSource object, got %T", a.GetObject()))
	}
	return validateNoTeamHTTPHeadersOnCreate(ctx, ds, &b.datasourceResourceInfo)
}

// Mutate preserves stored Team LBAC rules when a datasource PUT omits them.
// PATCH removal is rejected so an explicit attempt cannot silently erase them.
func (b *DataSourceAPIBuilder) Mutate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	isUpdate := a.GetOperation() == admission.Update
	isDatasourceResource := a.GetResource().Resource == b.datasourceResourceInfo.GetName()
	if !isUpdate || !isDatasourceResource || !teamHTTPHeadersWriteGuardEnabled(ctx) {
		return nil
	}
	// UpdatedObjectInfo runs admission against SQL first, then against the
	// Unified Storage copy. Only SQL is authoritative during dual write; a
	// stale Unified copy must not reject an update SQL already accepted.
	if dualwrite.IsMirroredUpdate(ctx) {
		return nil
	}
	proposed, ok := a.GetObject().(*datasourceV0.DataSource)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected DataSource object, got %T", a.GetObject()))
	}
	stored, ok := a.GetOldObject().(*datasourceV0.DataSource)
	if !ok {
		return apierrors.NewBadRequest(fmt.Sprintf("expected stored DataSource object, got %T", a.GetOldObject()))
	}
	storedJSONData, _ := stored.Spec.JSONData().(map[string]any)
	storedHeaders, storedHasHeaders := storedJSONData["teamHttpHeaders"]
	proposedJSONData, _ := proposed.Spec.JSONData().(map[string]any)
	proposedHeaders, proposedHasHeaders := proposedJSONData["teamHttpHeaders"]
	if proposedHasHeaders && (!storedHasHeaders || !reflect.DeepEqual(proposedHeaders, storedHeaders)) {
		return invalidTeamHTTPHeadersUpdate(proposed, &b.datasourceResourceInfo)
	}
	// The proposed object either echoes the stored rules or has no rules.
	// Only a missing proposed field alongside stored rules needs more handling.
	if !storedHasHeaders || proposedHasHeaders {
		return nil
	}

	// The stored object has Team LBAC rules, but the proposed object does not.
	// PATCH starts from the stored object, so this difference means the patch
	// removed the field (possibly by replacing all of jsonData).
	requestInfo, hasRequestInfo := request.RequestInfoFrom(ctx)
	if hasRequestInfo && requestInfo.Verb == "patch" {
		return invalidTeamHTTPHeadersUpdate(proposed, &b.datasourceResourceInfo)
	}
	// A PUT replaces the whole object. Carry forward the protected field so an
	// unrelated datasource edit cannot remove rules that belong to TeamLBACRule.
	// This matches the legacy SQL update's RetainExistingLBACRules behavior:
	// https://github.com/grafana/grafana/blob/054d246e5104058959de1aa165e7bc520778b89e/pkg/services/datasources/service/datasource.go#L1129-L1153
	proposedJSONData = maps.Clone(proposedJSONData)
	if proposedJSONData == nil {
		proposedJSONData = make(map[string]any)
	}
	proposedJSONData["teamHttpHeaders"] = runtime.DeepCopyJSONValue(storedHeaders)
	proposed.Spec.SetJSONData(proposedJSONData)
	return nil
}

func invalidTeamHTTPHeadersUpdate(proposed *datasourceV0.DataSource, resourceInfo *utils.ResourceInfo) error {
	return apierrors.NewInvalid(resourceInfo.GroupVersionKind().GroupKind(), proposed.Name, field.ErrorList{
		field.Forbidden(field.NewPath("spec", "jsonData", "teamHttpHeaders"), "manage Team LBAC rules through the TeamLBACRule API"),
	})
}

func validateNoTeamHTTPHeadersOnCreate(ctx context.Context, ds *datasourceV0.DataSource, resourceInfo *utils.ResourceInfo) error {
	if !teamHTTPHeadersWriteGuardEnabled(ctx) {
		return nil
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
		return apierrors.NewInvalid(resourceInfo.GroupVersionKind().GroupKind(), ds.Name, field.ErrorList{
			field.Forbidden(field.NewPath("spec", "jsonData", "teamHttpHeaders"), "manage Team LBAC rules through the TeamLBACRule API"),
		})
	}
	return nil
}

func teamHTTPHeadersWriteGuardEnabled(ctx context.Context) bool {
	return openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagDatasourcesTeamHttpHeadersWriteGuard, false, openfeature.TransactionContext(ctx))
}
