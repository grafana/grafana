package alertrule

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/store"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
)

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
func (fakeRuleAccessControl) AuthorizeRuleChanges(context.Context, identity.Requester, *store.GroupDelta) error {
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

	rule := &model.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "no-summary-rule",
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder": "test-folder-uid",
			},
		},
		Spec: model.AlertRuleSpec{
			Title:        "no-summary-rule",
			Trigger:      model.AlertRuleIntervalTrigger{Interval: "1m"},
			NoDataState:  model.AlertRuleNoDataStateNoData,
			ExecErrState: model.AlertRuleExecErrStateError,
			Expressions: model.AlertRuleExpressionMap{
				"A": model.AlertRuleExpression{
					Model:  map[string]interface{}{"type": "math", "expression": "1 == 1", "refId": "A"},
					Source: boolPtr(true),
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

func boolPtr(b bool) *bool { return &b }
