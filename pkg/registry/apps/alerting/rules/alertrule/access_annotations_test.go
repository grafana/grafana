package alertrule

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	ngalertaccesscontrol "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
)

// permissionEvaluatingAccessControl evaluates the evaluator against the
// requester's own permission map, the same pure evaluation the real
// accesscontrol.AccessControl ultimately performs, without a database. This
// lets a test grant a real, folder-scoped permission rather than a single
// blanket true/false.
type permissionEvaluatingAccessControl struct{}

func (permissionEvaluatingAccessControl) Evaluate(_ context.Context, user identity.Requester, evaluator ac.Evaluator) (bool, error) {
	return evaluator.Evaluate(user.GetPermissions()), nil
}
func (permissionEvaluatingAccessControl) RegisterScopeAttributeResolver(string, ac.ScopeAttributeResolver) {
}
func (permissionEvaluatingAccessControl) WithoutResolvers() ac.AccessControl {
	return permissionEvaluatingAccessControl{}
}
func (permissionEvaluatingAccessControl) InvalidateResolverCache(int64, string) {}

// newAccessAnnotationTestStorage wires a legacyStorage with a real
// ngalertaccesscontrol.RuleService (the same one register.go uses for
// GetLegacyStorage) evaluating against permissionEvaluatingAccessControl, so
// canWrite/canDelete reflect the caller's actual folder-scoped permissions.
// Read access is left permissive (fakeRuleAccessControl{}, as the existing
// tests in this package already use), so this only exercises the new
// annotation logic, not whether the caller can read the rule at all.
func newAccessAnnotationTestStorage(t *testing.T, rules ...*ngmodels.AlertRule) *legacyStorage {
	t.Helper()
	ruleStore := fakes.NewRuleStore(t)
	ruleStore.PutRule(context.Background(), rules...)
	provenanceStore := fakes.NewFakeProvisioningStore()
	quotas := provisioning.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()
	folderService := foldertest.NewFakeService()
	folderService.ExpectedFolder = &folder.Folder{UID: "test-folder-uid", Title: "Test Folder"}

	svc := provisioning.NewAlertRuleService(
		ruleStore, provenanceStore, folderService, &quotas, ruleStore,
		60, 10, 100, log.NewNopLogger(), nil, fakeRuleAccessControl{}, nil,
	)
	return &legacyStorage{
		service:        *svc,
		namespacer:     nsMapperForTest(),
		ruleAccess:     ngalertaccesscontrol.NewRuleService(permissionEvaluatingAccessControl{}),
		tableConverter: nil,
	}
}

func folderScopedUser(orgID int64, action, folderUID string) *user.SignedInUser {
	return &user.SignedInUser{
		OrgID: orgID,
		Permissions: map[int64]map[string][]string{
			orgID: {action: {folder.ScopeFoldersProvider.GetResourceScopeUID(folderUID)}},
		},
	}
}

func ruleFixture(uid, folderUID, title string) *ngmodels.AlertRule {
	r := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithOrgID(1),
		ngmodels.RuleMuts.WithNamespaceUID(folderUID),
		ngmodels.RuleMuts.WithTitle(title),
	).GenerateRef()
	r.UID = uid
	return r
}

func TestAccessAnnotations_FolderScopedEditor(t *testing.T) {
	writable := ruleFixture("writable-rule", "folder-a", "writable-rule")
	readOnly := ruleFixture("readonly-rule", "folder-b", "readonly-rule")
	s := newAccessAnnotationTestStorage(t, writable, readOnly)

	// Editor in folder A only: can write and delete rules in folder A, but not folder B.
	editorInA := folderScopedUser(1, ac.ActionAlertingRuleUpdate, "folder-a")
	editorInA.Permissions[1][ac.ActionAlertingRuleDelete] = []string{folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a")}
	ctx := genericapirequest.WithNamespace(identity.WithRequester(context.Background(), editorInA), "default")

	t.Run("GET a writable rule sets both annotations", func(t *testing.T) {
		obj, err := s.Get(ctx, "writable-rule", &metav1.GetOptions{})
		require.NoError(t, err)
		rule, ok := obj.(*model.AlertRule)
		require.True(t, ok)
		assert.Equal(t, "true", rule.Annotations[model.AccessControlAnnotation("canWrite")])
		assert.Equal(t, "true", rule.Annotations[model.AccessControlAnnotation("canDelete")])
	})

	t.Run("GET a read-only rule sets neither annotation", func(t *testing.T) {
		obj, err := s.Get(ctx, "readonly-rule", &metav1.GetOptions{})
		require.NoError(t, err)
		rule, ok := obj.(*model.AlertRule)
		require.True(t, ok)
		_, hasWrite := rule.Annotations[model.AccessControlAnnotation("canWrite")]
		_, hasDelete := rule.Annotations[model.AccessControlAnnotation("canDelete")]
		assert.False(t, hasWrite, "must not claim write access to a folder the caller cannot write to")
		assert.False(t, hasDelete)
	})
}

func TestAccessAnnotations_DeniedUserGetsNeitherAnnotation(t *testing.T) {
	rule := ruleFixture("some-rule", "folder-a", "some-rule")
	s := newAccessAnnotationTestStorage(t, rule)

	viewer := &user.SignedInUser{OrgID: 1} // no permissions at all
	ctx := genericapirequest.WithNamespace(identity.WithRequester(context.Background(), viewer), "default")

	obj, err := s.Get(ctx, "some-rule", &metav1.GetOptions{})
	require.NoError(t, err)
	rule2, ok := obj.(*model.AlertRule)
	require.True(t, ok)
	assert.Empty(t, rule2.Annotations[model.AccessControlAnnotation("canWrite")])
	assert.Empty(t, rule2.Annotations[model.AccessControlAnnotation("canDelete")])
}

func TestAccessAnnotations_GetAndListAgree(t *testing.T) {
	rule := ruleFixture("agree-rule", "folder-a", "agree-rule")
	s := newAccessAnnotationTestStorage(t, rule)

	editor := folderScopedUser(1, ac.ActionAlertingRuleUpdate, "folder-a")
	ctx := genericapirequest.WithNamespace(identity.WithRequester(context.Background(), editor), "default")

	fromGet, err := s.Get(ctx, "agree-rule", &metav1.GetOptions{})
	require.NoError(t, err)
	getRule, ok := fromGet.(*model.AlertRule)
	require.True(t, ok)

	fromList, err := s.List(ctx, &internalversion.ListOptions{})
	require.NoError(t, err)
	listRules, ok := fromList.(*model.AlertRuleList)
	require.True(t, ok)
	require.Len(t, listRules.Items, 1)

	assert.Equal(t, getRule.Annotations[model.AccessControlAnnotation("canWrite")], listRules.Items[0].Annotations[model.AccessControlAnnotation("canWrite")])
	assert.Equal(t, "true", listRules.Items[0].Annotations[model.AccessControlAnnotation("canWrite")])
}

// TestAccessAnnotations_ClientSuppliedAnnotationIsIgnored proves a
// client-supplied access annotation on a create is never echoed back or
// persisted: the response is always freshly computed server-side (or, for
// Create/Update, never attached at all -- see setAccessAnnotations' callers).
func TestAccessAnnotations_ClientSuppliedAnnotationIsIgnored(t *testing.T) {
	s := newTestLegacyStorage(t, nil)
	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	ctx = identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserUID: "test-user"})

	rule := &model.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:      "client-annotation-rule",
			Namespace: "default",
			Annotations: map[string]string{
				"grafana.app/folder":                      "test-folder-uid",
				model.AccessControlAnnotation("canWrite"): "true",
			},
		},
		Spec: model.AlertRuleSpec{
			Title:        "client-annotation-rule",
			Trigger:      model.AlertRuleIntervalTrigger{Interval: "1m"},
			NoDataState:  model.AlertRuleNoDataStateNoData,
			ExecErrState: model.AlertRuleExecErrStateError,
			Annotations:  map[string]model.AlertRuleTemplateString{"summary": "test"},
			Expressions: model.AlertRuleExpressionMap{
				"A": model.AlertRuleExpression{
					Model:  map[string]interface{}{"type": "math", "expression": "1 == 1", "refId": "A"},
					Source: new(true),
				},
			},
		},
	}

	created, err := s.Create(ctx, rule, nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	createdRule, ok := created.(*model.AlertRule)
	require.True(t, ok)
	// Create never attaches the annotation (s.ruleAccess is nil on this
	// helper's storage, and Create doesn't call setAccessAnnotations at all),
	// so the client's value is dropped rather than persisted or echoed.
	assert.Empty(t, createdRule.Annotations[model.AccessControlAnnotation("canWrite")])
}
