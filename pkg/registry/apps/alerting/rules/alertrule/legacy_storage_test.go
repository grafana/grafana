package alertrule

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
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
	ngalertac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
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
	unified := ruleCleanupStorage{deleteFn: func(_ context.Context, _ k8srest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
		return &v1beta1.AlertRuleList{Items: []v1beta1.AlertRule{{ObjectMeta: metav1.ObjectMeta{Name: "from-unified"}}}}, nil
	}}
	legacyStore, ruleStore := newTestLegacyStorageWithStore(t, nil)
	ruleStore.Rules = map[int64][]*ngmodels.AlertRule{1: {newAlertingRule("legacy-rule", "folder-1")}}
	storage, err := svc.NewStorage(ResourceInfo.GroupResource(), legacyStore, unified)
	require.NoError(t, err)
	collectionDeleter, ok := storage.(k8srest.CollectionDeleter)
	require.True(t, ok)
	ctx := deleteCollectionTestContext()

	// While legacy is still in use for reads, collection deletion removes the legacy rows.
	_, err = collectionDeleter.DeleteCollection(ctx, nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
	require.NoError(t, err)
	require.Empty(t, ruleStore.Rules[1])

	// After migration it is served by unified storage without recreating storage; legacy is no longer touched.
	ruleStore.Rules = map[int64][]*ngmodels.AlertRule{1: {newAlertingRule("legacy-rule", "folder-1")}}
	reader.mode = migrations.StorageModeUnified
	result, err := collectionDeleter.DeleteCollection(ctx, nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
	require.NoError(t, err)
	list, ok := result.(*v1beta1.AlertRuleList)
	require.True(t, ok)
	require.Len(t, list.Items, 1)
	require.Equal(t, "from-unified", list.Items[0].Name)
	require.Len(t, ruleStore.Rules[1], 1)
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
func (fakeRuleAccessControl) AuthorizeNotificationSettings(context.Context, identity.Requester, []ngalertac.ReceiverRef) error {
	return nil
}

func (fakeRuleAccessControl) HasAccessInFolder(context.Context, identity.Requester, ngmodels.Namespaced) (bool, error) {
	return true, nil
}

func newTestLegacyStorage(t *testing.T, validator legacy.RuleMutationValidator) *legacyStorage {
	t.Helper()
	s, _ := newTestLegacyStorageWithStore(t, validator)
	return s
}

func newTestLegacyStorageWithStore(t *testing.T, validator legacy.RuleMutationValidator) (*legacyStorage, *fakes.RuleStore) {
	t.Helper()
	s, ruleStore, _ := newTestLegacyStorageWithStores(t, validator)
	return s, ruleStore
}

func newTestLegacyStorageWithStores(t *testing.T, validator legacy.RuleMutationValidator) (*legacyStorage, *fakes.RuleStore, *fakes.FakeProvisioningStore) {
	t.Helper()
	ruleStore := fakes.NewRuleStore(t)
	provenanceStore := fakes.NewFakeProvisioningStore()
	quotas := legacy.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()
	folderService := foldertest.NewFakeService()
	folderService.ExpectedFolder = &folder.Folder{UID: "test-folder-uid", Title: "Test Folder"}

	svc := legacy.NewLegacyRuleService(
		ruleStore, provenanceStore, folderService, &quotas, ruleStore,
		60, log.NewNopLogger(), nil, fakeRuleAccessControl{}, validator,
	)
	return &legacyStorage{service: *svc, namespacer: nsMapperForTest()}, ruleStore, provenanceStore
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

func deleteCollectionTestContext() context.Context {
	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	return identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserUID: "test-user"})
}

func newAlertingRule(uid, folderUID string) *ngmodels.AlertRule {
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithOrgID(1), gen.WithUID(uid), gen.WithNamespaceUID(folderUID)).GenerateRef()
	rule.Record = nil // ensure alerting type
	// The k8s conversion marks the query matching the condition as the source; it must exist to round-trip.
	rule.Condition = rule.Data[0].RefID
	return rule
}

func ruleUIDs(rules []*ngmodels.AlertRule) []string {
	out := make([]string, 0, len(rules))
	for _, r := range rules {
		out = append(out, r.UID)
	}
	return out
}

func TestDeleteCollection(t *testing.T) {
	setup := func(t *testing.T) (*legacyStorage, *fakes.RuleStore) {
		t.Helper()
		s, ruleStore := newTestLegacyStorageWithStore(t, nil)
		// Scoping to alerting rules is done by the RuleType filter of the store query, which the fake store ignores.
		ruleStore.Rules = map[int64][]*ngmodels.AlertRule{1: {
			newAlertingRule("a1", "folder-1"),
			newAlertingRule("a2", "folder-1"),
			newAlertingRule("b1", "folder-2"),
		}}
		return s, ruleStore
	}

	t.Run("deletes a rule whose manager cannot be reset to unmanaged", func(t *testing.T) {
		// A repo-managed rule can only be deleted by its manager, so this fails if the manager derived from the listed
		// rule is not handed to the service.
		s, ruleStore, provenance := newTestLegacyStorageWithStores(t, nil)
		ruleStore.Rules = map[int64][]*ngmodels.AlertRule{1: {newAlertingRule("a1", "folder-1")}}
		repo := utils.ManagerProperties{Kind: utils.ManagerKindRepo, Identity: "repo"}
		provenance.GetAllManagerPropertiesFunc = func(context.Context, int64, string) (map[string]utils.ManagerProperties, error) {
			return map[string]utils.ManagerProperties{"a1": repo}, nil
		}
		provenance.GetManagerPropertiesFunc = func(context.Context, ngmodels.Provisionable, int64) (utils.ManagerProperties, error) {
			return repo, nil
		}

		_, err := s.DeleteCollection(deleteCollectionTestContext(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
		require.NoError(t, err)
		require.Empty(t, ruleStore.Rules[1])
	})

	t.Run("deletes all alert rules and returns them", func(t *testing.T) {
		s, ruleStore := setup(t)

		result, err := s.DeleteCollection(deleteCollectionTestContext(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
		require.NoError(t, err)

		require.Empty(t, ruleStore.Rules[1])
		list, ok := result.(*v1beta1.AlertRuleList)
		require.True(t, ok)
		names := make([]string, 0, len(list.Items))
		for _, item := range list.Items {
			names = append(names, item.Name)
		}
		require.ElementsMatch(t, []string{"a1", "a2", "b1"}, names)
	})

	t.Run("only deletes rules matching the label selector", func(t *testing.T) {
		s, ruleStore := setup(t)
		selector, err := labels.Parse(v1beta1.FolderLabelKey + "=folder-1")
		require.NoError(t, err)

		_, err = s.DeleteCollection(deleteCollectionTestContext(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{LabelSelector: selector})
		require.NoError(t, err)

		require.Equal(t, []string{"b1"}, ruleUIDs(ruleStore.Rules[1]))
	})

	t.Run("deletes nothing when the delete validation rejects any rule", func(t *testing.T) {
		s, ruleStore := setup(t)
		rejected := errors.New("rule belongs to a sequence")
		validate := func(_ context.Context, obj runtime.Object) error {
			if obj.(*v1beta1.AlertRule).Name == "a2" {
				return rejected
			}
			return nil
		}

		_, err := s.DeleteCollection(deleteCollectionTestContext(), validate, &metav1.DeleteOptions{}, &internalversion.ListOptions{})

		require.ErrorIs(t, err, rejected)
		require.Len(t, ruleStore.Rules[1], 3)
	})

	t.Run("rejects dry-run requests without deleting", func(t *testing.T) {
		s, ruleStore := setup(t)

		_, err := s.DeleteCollection(deleteCollectionTestContext(), nil, &metav1.DeleteOptions{DryRun: []string{metav1.DryRunAll}}, &internalversion.ListOptions{})

		require.True(t, apierrors.IsBadRequest(err), "got %v", err)
		require.Len(t, ruleStore.Rules[1], 3)
	})

	t.Run("rejects history and trash selectors without deleting", func(t *testing.T) {
		s, ruleStore := setup(t)
		for _, key := range []string{utils.LabelKeyGetHistory, utils.LabelKeyGetTrash} {
			selector, err := labels.Parse(key + "=true")
			require.NoError(t, err)

			_, err = s.DeleteCollection(deleteCollectionTestContext(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{LabelSelector: selector})

			require.True(t, apierrors.IsBadRequest(err), "%s: got %v", key, err)
			require.Len(t, ruleStore.Rules[1], 3)
		}
	})

	t.Run("succeeds when nothing matches", func(t *testing.T) {
		s, ruleStore := newTestLegacyStorageWithStore(t, nil)

		result, err := s.DeleteCollection(deleteCollectionTestContext(), nil, &metav1.DeleteOptions{}, nil)
		require.NoError(t, err)

		require.Empty(t, result.(*v1beta1.AlertRuleList).Items)
		require.Empty(t, ruleStore.Rules[1])
	})
}
