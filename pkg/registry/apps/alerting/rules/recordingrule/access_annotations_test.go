package recordingrule

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/infra/log"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	ngalertaccesscontrol "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
	rulestore "github.com/grafana/grafana/pkg/services/ngalert/store/rules"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
)

// fakeRuleAccessControl grants everything for the provisioning service's own
// read authorization, so these tests exercise only the new canWrite/canDelete
// annotation logic, not whether the caller can read the rule at all.
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

// permissionEvaluatingAccessControl evaluates the evaluator against the
// requester's own permission map -- the same pure evaluation the real
// accesscontrol.AccessControl ultimately performs, without a database.
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
		service:    *svc,
		namespacer: nsMapperForTest(),
		ruleAccess: ngalertaccesscontrol.NewRuleService(permissionEvaluatingAccessControl{}),
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

func recordingRuleFixture(uid, folderUID, title string) *ngmodels.AlertRule {
	r := ngmodels.RuleGen.With(
		ngmodels.RuleMuts.WithOrgID(1),
		ngmodels.RuleMuts.WithNamespaceUID(folderUID),
		ngmodels.RuleMuts.WithTitle(title),
		ngmodels.RuleMuts.WithAllRecordingRules(),
		ngmodels.RuleMuts.WithMetric("metric1"),
		ngmodels.RuleMuts.WithRecordFrom("A"),
	).GenerateRef()
	r.UID = uid
	return r
}

func TestAccessAnnotations_FolderScopedEditor(t *testing.T) {
	writable := recordingRuleFixture("writable-rule", "folder-a", "writable-rule")
	readOnly := recordingRuleFixture("readonly-rule", "folder-b", "readonly-rule")
	s := newAccessAnnotationTestStorage(t, writable, readOnly)

	editorInA := folderScopedUser(1, ac.ActionAlertingRuleUpdate, "folder-a")
	editorInA.Permissions[1][ac.ActionAlertingRuleDelete] = []string{folder.ScopeFoldersProvider.GetResourceScopeUID("folder-a")}
	ctx := genericapirequest.WithNamespace(identity.WithRequester(context.Background(), editorInA), "default")

	t.Run("GET a writable rule sets both annotations", func(t *testing.T) {
		obj, err := s.Get(ctx, "writable-rule", &metav1.GetOptions{})
		require.NoError(t, err)
		rule, ok := obj.(*model.RecordingRule)
		require.True(t, ok)
		assert.Equal(t, "true", rule.Annotations[model.AccessControlAnnotation("canWrite")])
		assert.Equal(t, "true", rule.Annotations[model.AccessControlAnnotation("canDelete")])
	})

	t.Run("GET a read-only rule sets neither annotation", func(t *testing.T) {
		obj, err := s.Get(ctx, "readonly-rule", &metav1.GetOptions{})
		require.NoError(t, err)
		rule, ok := obj.(*model.RecordingRule)
		require.True(t, ok)
		assert.Empty(t, rule.Annotations[model.AccessControlAnnotation("canWrite")])
		assert.Empty(t, rule.Annotations[model.AccessControlAnnotation("canDelete")])
	})
}

func TestAccessAnnotations_GetAndListAgree(t *testing.T) {
	rule := recordingRuleFixture("agree-rule", "folder-a", "agree-rule")
	s := newAccessAnnotationTestStorage(t, rule)

	editor := folderScopedUser(1, ac.ActionAlertingRuleUpdate, "folder-a")
	ctx := genericapirequest.WithNamespace(identity.WithRequester(context.Background(), editor), "default")

	fromGet, err := s.Get(ctx, "agree-rule", &metav1.GetOptions{})
	require.NoError(t, err)
	getRule, ok := fromGet.(*model.RecordingRule)
	require.True(t, ok)

	fromList, err := s.List(ctx, &internalversion.ListOptions{})
	require.NoError(t, err)
	listRules, ok := fromList.(*model.RecordingRuleList)
	require.True(t, ok)
	require.Len(t, listRules.Items, 1)

	assert.Equal(t, "true", getRule.Annotations[model.AccessControlAnnotation("canWrite")])
	assert.Equal(t, getRule.Annotations[model.AccessControlAnnotation("canWrite")], listRules.Items[0].Annotations[model.AccessControlAnnotation("canWrite")])
}
