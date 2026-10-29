package alertrule

import (
	"context"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	k8srest "k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/storage/legacysql/dualwrite"
	migrations "github.com/grafana/grafana/pkg/storage/unified/migrations/contract"
)

type ruleCleanupStatusReader struct {
	migrations.MigrationStatusReader
	mode migrations.StorageMode
}

func (r *ruleCleanupStatusReader) GetStorageMode(context.Context, schema.GroupResource) (migrations.StorageMode, error) {
	return r.mode, nil
}

type ruleCleanupStorage struct {
	rest.Storage
	deleteFn func(context.Context, k8srest.ValidateObjectFunc, *metav1.DeleteOptions, *internalversion.ListOptions) (runtime.Object, error)
}

func (s ruleCleanupStorage) DeleteCollection(ctx context.Context, validate k8srest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return s.deleteFn(ctx, validate, options, listOptions)
}

func TestDeleteCollection_afterMigrationRoutesToUnifiedStorage(t *testing.T) {
	reader := &ruleCleanupStatusReader{
		MigrationStatusReader: dualwrite.NewFakeMigrationStatusReader(),
		mode:                  migrations.StorageModeDualWrite,
	}
	svc, err := dualwrite.ProvideService(dualwrite.NewFakeConfig(), dualwrite.NewFakeMigrator(), reader, prometheus.NewRegistry())
	require.NoError(t, err)
	deleted := false
	unified := ruleCleanupStorage{deleteFn: func(_ context.Context, _ k8srest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
		deleted = true
		return &v1beta1.AlertRuleList{}, nil
	}}
	storage, err := svc.NewStorage(ResourceInfo.GroupResource(), &legacyStorage{}, unified)
	require.NoError(t, err)
	collectionDeleter, ok := storage.(k8srest.CollectionDeleter)
	require.True(t, ok)
	_, err = collectionDeleter.DeleteCollection(context.Background(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
	require.True(t, apierrors.IsMethodNotSupported(err), "legacy collection deletion remains unsupported")
	require.False(t, deleted)

	reader.mode = migrations.StorageModeUnified
	result, err := collectionDeleter.DeleteCollection(context.Background(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
	require.NoError(t, err)
	require.IsType(t, &v1beta1.AlertRuleList{}, result)
	require.True(t, deleted, "migration must enable collection cleanup without recreating storage")
}

func TestToAPIError(t *testing.T) {
	t.Run("validation failure becomes BadRequest", func(t *testing.T) {
		err := toAPIError("my-rule", fmt.Errorf("%w: missing annotations.summary", ngmodels.ErrAlertRuleFailedValidation))
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(400), statusErr.Status().Code)
	})

	t.Run("quota reached becomes Forbidden, naming the rule", func(t *testing.T) {
		err := toAPIError("my-rule", ngmodels.ErrQuotaReached)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(403), statusErr.Status().Code)
		require.Equal(t, "my-rule", statusErr.Status().Details.Name)
	})

	t.Run("not found stays NotFound, naming the rule", func(t *testing.T) {
		err := toAPIError("my-rule", ngmodels.ErrAlertRuleNotFound)
		var statusErr *apierrors.StatusError
		require.ErrorAs(t, err, &statusErr)
		require.Equal(t, int32(404), statusErr.Status().Code)
		require.Equal(t, "my-rule", statusErr.Status().Details.Name)
	})

	t.Run("unrecognized error passes through unchanged", func(t *testing.T) {
		original := fmt.Errorf("boom")
		require.Same(t, original, toAPIError("my-rule", original))
	})
}

// failingRuleValidator always rejects, standing in for the real quality-policy gate
// without needing enterprise code in an OSS test.
type failingRuleValidator struct{}

func (failingRuleValidator) ValidateRuleMutations(context.Context, []*ngmodels.AlertRule, utils.ManagerProperties) error {
	return fmt.Errorf("%w: missing annotations.summary", ngmodels.ErrAlertRuleFailedValidation)
}

// fakeRuleAccessControl grants everything; only used to exercise the error-mapping path,
// not authorization itself.
type fakeRuleAccessControl struct{}

func (fakeRuleAccessControl) HasAccess(context.Context, identity.Requester, ac.Evaluator) (bool, error) {
	return true, nil
}
func (fakeRuleAccessControl) AuthorizeAccessToRuleGroup(context.Context, identity.Requester, ngmodels.RulesGroup) error {
	return nil
}
func (fakeRuleAccessControl) AuthorizeAccessInFolder(context.Context, identity.Requester, ngmodels.Namespaced) error {
	return nil
}
func (fakeRuleAccessControl) AuthorizeRuleChanges(context.Context, identity.Requester, *rulestore.GroupDelta) error {
	return nil
}
func (fakeRuleAccessControl) HasAccessInFolder(context.Context, identity.Requester, ngmodels.Namespaced) (bool, error) {
	return true, nil
}

func newTestLegacyStorage(t *testing.T, validator provisioning.RuleMutationValidator) *legacyStorage {
	t.Helper()
	ruleStore := fakes.NewRuleStore(t)
	provenanceStore := fakes.NewFakeProvisioningStore()
	quotas := provisioning.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()
	folderService := foldertest.NewFakeService()
	folderService.ExpectedFolder = &folder.Folder{UID: "test-folder-uid", Title: "Test Folder"}

	svc := provisioning.NewAlertRuleService(
		ruleStore, provenanceStore, folderService, &quotas, ruleStore,
		60, 10, 100, log.NewNopLogger(), nil, fakeRuleAccessControl{}, validator,
	)
	return &legacyStorage{service: *svc, namespacer: nsMapperForTest()}
}

// TestCreate_QualityPolicyRejection exercises Create end-to-end, asserting the status
// code the caller actually receives when the quality policy rejects the rule.
func TestCreate_QualityPolicyRejection(t *testing.T) {
	s := newTestLegacyStorage(t, failingRuleValidator{})
	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	ctx = identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserUID: "test-user"})

	rule := &v1beta1.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "no-summary-rule",
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder-uid",
			},
		},
		Spec: v1beta1.AlertRuleSpec{
			Title:        "no-summary-rule",
			Trigger:      v1beta1.AlertRuleIntervalTrigger{Interval: "1m"},
			NoDataState:  v1beta1.AlertRuleNoDataStateNoData,
			ExecErrState: v1beta1.AlertRuleExecErrStateError,
			Expressions: v1beta1.AlertRuleExpressionMap{
				"A": v1beta1.AlertRuleExpression{
					Model:  map[string]interface{}{"type": "math", "expression": "1 == 1", "refId": "A"},
					Source: new(true),
				},
			},
		},
	}

	_, err := s.Create(ctx, rule, nil, &metav1.CreateOptions{})
	require.Error(t, err)
	var statusErr *apierrors.StatusError
	require.ErrorAs(t, err, &statusErr)
	require.Equal(t, int32(400), statusErr.Status().Code)
	require.Contains(t, statusErr.Status().Message, "missing annotations.summary")
}
