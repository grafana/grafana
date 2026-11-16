package recordingrule

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
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
)

// fakeRuleAccessControl grants everything; authorization itself is covered by the service tests.
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

func newTestLegacyStorageWithStore(t *testing.T) (*legacyStorage, *fakes.RuleStore) {
	t.Helper()
	ruleStore := fakes.NewRuleStore(t)
	quotas := legacy.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()
	folderService := foldertest.NewFakeService()
	folderService.ExpectedFolder = &folder.Folder{UID: "folder-1", Title: "Folder"}

	svc := legacy.NewLegacyRuleService(
		ruleStore, fakes.NewFakeProvisioningStore(), folderService, &quotas, ruleStore,
		60, log.NewNopLogger(), nil, fakeRuleAccessControl{}, nil,
	)
	return &legacyStorage{service: *svc, namespacer: nsMapperForTest()}, ruleStore
}

func deleteCollectionTestContext() context.Context {
	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	return identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserUID: "test-user"})
}

func newRecordingRule(uid, folderUID string) *ngmodels.AlertRule {
	gen := ngmodels.RuleGen
	rule := gen.With(gen.WithOrgID(1), gen.WithUID(uid), gen.WithNamespaceUID(folderUID), gen.WithAllRecordingRules()).GenerateRef()
	// The k8s conversion marks the query matching the record source as the source; it must exist to round-trip.
	rule.Record.From = rule.Data[0].RefID
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
		s, ruleStore := newTestLegacyStorageWithStore(t)
		// Scoping to recording rules is done by the RuleType filter of the store query, which the fake store ignores.
		ruleStore.Rules = map[int64][]*ngmodels.AlertRule{1: {
			newRecordingRule("r1", "folder-1"),
			newRecordingRule("r2", "folder-1"),
			newRecordingRule("s1", "folder-2"),
		}}
		return s, ruleStore
	}

	t.Run("deletes all recording rules and returns them", func(t *testing.T) {
		s, ruleStore := setup(t)

		result, err := s.DeleteCollection(deleteCollectionTestContext(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{})
		require.NoError(t, err)

		require.Empty(t, ruleStore.Rules[1])
		list, ok := result.(*v1beta1.RecordingRuleList)
		require.True(t, ok)
		names := make([]string, 0, len(list.Items))
		for _, item := range list.Items {
			names = append(names, item.Name)
		}
		require.ElementsMatch(t, []string{"r1", "r2", "s1"}, names)
	})

	t.Run("only deletes rules matching the label selector", func(t *testing.T) {
		s, ruleStore := setup(t)
		selector, err := labels.Parse(v1beta1.FolderLabelKey + "=folder-1")
		require.NoError(t, err)

		_, err = s.DeleteCollection(deleteCollectionTestContext(), nil, &metav1.DeleteOptions{}, &internalversion.ListOptions{LabelSelector: selector})
		require.NoError(t, err)

		require.Equal(t, []string{"s1"}, ruleUIDs(ruleStore.Rules[1]))
	})

	t.Run("deletes nothing when the delete validation rejects any rule", func(t *testing.T) {
		s, ruleStore := setup(t)
		rejected := errors.New("rule belongs to a sequence")
		validate := func(_ context.Context, obj runtime.Object) error {
			if obj.(*v1beta1.RecordingRule).Name == "r2" {
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
}
