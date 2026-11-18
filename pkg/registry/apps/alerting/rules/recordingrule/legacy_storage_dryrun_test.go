package recordingrule

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	k8srest "k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
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

type allowAllRuleAccessControl struct{}

func (allowAllRuleAccessControl) HasAccess(context.Context, identity.Requester, ac.Evaluator) (bool, error) {
	return true, nil
}
func (allowAllRuleAccessControl) AuthorizeAccessToRuleGroup(context.Context, identity.Requester, ngmodels.RulesGroup) error {
	return nil
}
func (allowAllRuleAccessControl) AuthorizeAccessInFolder(context.Context, identity.Requester, ngmodels.Namespaced) error {
	return nil
}
func (allowAllRuleAccessControl) AuthorizeRuleChanges(context.Context, identity.Requester, *rulestore.GroupDelta) error {
	return nil
}
func (allowAllRuleAccessControl) AuthorizeNotificationSettings(context.Context, identity.Requester, []ngalertac.ReceiverRef) error {
	return nil
}
func (allowAllRuleAccessControl) HasAccessInFolder(context.Context, identity.Requester, ngmodels.Namespaced) (bool, error) {
	return true, nil
}

func newDryRunRecordingRule(name, title string) *v1beta1.RecordingRule {
	return &v1beta1.RecordingRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   "default",
			Annotations: map[string]string{"grafana.app/folder": "test-folder-uid"},
		},
		Spec: v1beta1.RecordingRuleSpec{
			Title:               title,
			Metric:              "dry_run_metric",
			TargetDatasourceUID: "target-ds",
			Trigger:             v1beta1.RecordingRuleIntervalTrigger{Interval: "1m"},
			Expressions: v1beta1.RecordingRuleExpressionMap{
				"A": v1beta1.RecordingRuleExpression{
					Model:  map[string]any{"type": "math", "expression": "1 + 1", "refId": "A"},
					Source: new(true),
				},
			},
		},
	}
}

func TestLegacyStorage_DryRun(t *testing.T) {
	ruleStore := fakes.NewRuleStore(t)
	quotas := legacy.MockQuotaChecker{}
	quotas.EXPECT().LimitOK()
	folderService := foldertest.NewFakeService()
	folderService.ExpectedFolder = &folder.Folder{UID: "test-folder-uid", Title: "Test Folder"}
	svc := legacy.NewLegacyRuleService(
		ruleStore, fakes.NewFakeProvisioningStore(), folderService, &quotas, ruleStore,
		60, log.NewNopLogger(), nil, allowAllRuleAccessControl{}, nil,
	)
	s := &legacyStorage{service: *svc, namespacer: nsMapperForTest()}
	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	ctx = identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserUID: "test-user"})
	dryRun := []string{metav1.DryRunAll}

	writes := func() []any {
		return ruleStore.GetRecordedCommands(func(cmd any) (any, bool) {
			switch c := cmd.(type) {
			case []ngmodels.InsertRule, []ngmodels.UpdateRule:
				return c, true
			case fakes.GenericRecordedQuery:
				return c, c.Name == "DeleteAlertRulesByUID"
			}
			return nil, false
		})
	}

	out, err := s.Create(ctx, newDryRunRecordingRule("dry-create", "dry"), nil, &metav1.CreateOptions{DryRun: dryRun})
	require.NoError(t, err)
	require.Equal(t, "dry", out.(*v1beta1.RecordingRule).Spec.Title)
	require.Empty(t, writes(), "dry-run create must not write")

	created, err := s.Create(ctx, newDryRunRecordingRule("stored", "original"), nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	stored := created.(*v1beta1.RecordingRule)
	ruleStore.RecordedOps = nil

	_, err = s.Create(ctx, newDryRunRecordingRule("stored", "other"), nil, &metav1.CreateOptions{DryRun: dryRun})
	require.ErrorIs(t, err, ngmodels.ErrAlertRuleConflictBase, "dry-run create of an existing name must conflict")
	require.Empty(t, writes(), "dry-run create of an existing name must not write")

	changed := stored.DeepCopy()
	changed.Spec.Title = "changed"
	out, _, err = s.Update(ctx, stored.Name, k8srest.DefaultUpdatedObjectInfo(changed), nil, nil, false, &metav1.UpdateOptions{DryRun: dryRun})
	require.NoError(t, err)
	updated := out.(*v1beta1.RecordingRule)
	require.Equal(t, "changed", updated.Spec.Title)
	require.Equal(t, stored.ResourceVersion, updated.ResourceVersion)
	require.Empty(t, writes(), "dry-run update must not write")

	out, err = s.PrepareDryRunUpdate(ctx, stored.Name, k8srest.DefaultUpdatedObjectInfo(changed))
	require.NoError(t, err)
	require.Equal(t, "changed", out.(*v1beta1.RecordingRule).Spec.Title)
	require.NotEqual(t, changed.Name, string(changed.UID), "the stored UID must differ from the name for this check to mean anything")
	require.Equal(t, changed.UID, out.(*v1beta1.RecordingRule).UID, "PrepareDryRunUpdate must not change the UID")
	require.Empty(t, writes(), "PrepareDryRunUpdate must not write")

	_, _, err = s.Delete(ctx, stored.Name, nil, &metav1.DeleteOptions{DryRun: dryRun})
	require.NoError(t, err)
	require.Empty(t, writes(), "dry-run delete must not write")

	current, err := s.Get(ctx, stored.Name, nil)
	require.NoError(t, err)
	require.Equal(t, "original", current.(*v1beta1.RecordingRule).Spec.Title)
}
