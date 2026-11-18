package alertrule

import (
	"context"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
	k8srest "k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	"github.com/grafana/grafana/pkg/services/folder/foldertest"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/rules/legacy"
	"github.com/grafana/grafana/pkg/services/ngalert/tests/fakes"
	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

var dryRunAll = []string{metav1.DryRunAll}

// switchableValidator rejects every mutation while err is set.
type switchableValidator struct{ err error }

func (v *switchableValidator) ValidateRuleMutations(context.Context, []*ngmodels.AlertRule, utils.ManagerProperties) error {
	return v.err
}

type recordingStatusWriter struct{ calls int }

func (w *recordingStatusWriter) SaveAlertRuleStatus(context.Context, int64, string, []byte) error {
	w.calls++
	return nil
}

type dryRunFixture struct {
	storage   *legacyStorage
	ruleStore *fakes.RuleStore
	validator *switchableValidator
	ctx       context.Context
}

func newDryRunFixture(t *testing.T, quotaReached bool) *dryRunFixture {
	t.Helper()
	ruleStore := fakes.NewRuleStore(t)
	quotas := legacy.MockQuotaChecker{}
	if quotaReached {
		quotas.EXPECT().LimitExceeded()
	} else {
		quotas.EXPECT().LimitOK()
	}
	folderService := foldertest.NewFakeService()
	folderService.ExpectedFolder = &folder.Folder{UID: "test-folder-uid", Title: "Test Folder"}
	validator := &switchableValidator{}
	svc := legacy.NewLegacyRuleService(
		ruleStore, fakes.NewFakeProvisioningStore(), folderService, &quotas, ruleStore,
		60, log.NewNopLogger(), nil, fakeRuleAccessControl{}, validator,
	)
	ctx := genericapirequest.WithNamespace(context.Background(), "default")
	ctx = identity.WithRequester(ctx, &user.SignedInUser{OrgID: 1, UserUID: "test-user"})
	return &dryRunFixture{
		storage:   &legacyStorage{rules: legacy.NewAlertRules(svc, request.GetNamespaceMapper(&setting.Cfg{}))},
		ruleStore: ruleStore,
		validator: validator,
		ctx:       ctx,
	}
}

// seed stores a rule for the update and delete cases and forgets the writes it took.
func (f *dryRunFixture) seed(t *testing.T, name string) *v1beta1.AlertRule {
	t.Helper()
	created, err := f.storage.Create(f.ctx, newDryRunRule(name, "original"), nil, &metav1.CreateOptions{})
	require.NoError(t, err)
	// The real store assigns the version on insert, which the fake doesn't.
	for _, r := range f.ruleStore.Rules[1] {
		r.Version = 1
	}
	f.ruleStore.RecordedOps = nil
	return created.(*v1beta1.AlertRule)
}

// writes returns the recorded rule store operations that would change stored rules.
func (f *dryRunFixture) writes() []any {
	return f.ruleStore.GetRecordedCommands(func(cmd any) (any, bool) {
		switch c := cmd.(type) {
		case []ngmodels.InsertRule, []ngmodels.UpdateRule:
			return c, true
		case fakes.GenericRecordedQuery:
			return c, c.Name == "DeleteAlertRulesByUID"
		}
		return nil, false
	})
}

func newDryRunRule(name, title string) *v1beta1.AlertRule {
	return &v1beta1.AlertRule{
		ObjectMeta: metav1.ObjectMeta{
			Name:        name,
			Namespace:   "default",
			Annotations: map[string]string{"grafana.app/folder": "test-folder-uid"},
		},
		Spec: v1beta1.AlertRuleSpec{
			Title:        title,
			Trigger:      v1beta1.AlertRuleIntervalTrigger{Interval: "1m"},
			NoDataState:  v1beta1.AlertRuleNoDataStateNoData,
			ExecErrState: v1beta1.AlertRuleExecErrStateError,
			Expressions: v1beta1.AlertRuleExpressionMap{
				"A": v1beta1.AlertRuleExpression{
					Model:  map[string]any{"type": "math", "expression": "1 == 1", "refId": "A"},
					Source: new(true),
				},
			},
		},
	}
}

func TestLegacyStorage_DryRun(t *testing.T) {
	t.Run("create returns the would-be rule and writes nothing", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		out, err := f.storage.Create(f.ctx, newDryRunRule("dry-create", "dry"), nil, &metav1.CreateOptions{DryRun: dryRunAll})
		require.NoError(t, err)
		rule := out.(*v1beta1.AlertRule)
		require.Equal(t, "dry-create", rule.Name)
		require.Equal(t, "dry", rule.Spec.Title)
		require.NotEmpty(t, rule.UID)
		require.Equal(t, "1", rule.ResourceVersion)
		require.Empty(t, f.writes())
		require.Empty(t, f.ruleStore.Rules[1])
	})

	t.Run("create still runs the rule service validation", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		f.validator.err = fmt.Errorf("%w: missing annotations.summary", ngmodels.ErrAlertRuleFailedValidation)
		_, err := f.storage.Create(f.ctx, newDryRunRule("dry-invalid", "dry"), nil, &metav1.CreateOptions{DryRun: dryRunAll})
		require.True(t, apierrors.IsBadRequest(err), "expected bad request, got %v", err)
		require.Empty(t, f.writes())
	})

	t.Run("create still checks the quota", func(t *testing.T) {
		f := newDryRunFixture(t, true)
		_, err := f.storage.Create(f.ctx, newDryRunRule("dry-quota", "dry"), nil, &metav1.CreateOptions{DryRun: dryRunAll})
		require.True(t, apierrors.IsForbidden(err), "expected forbidden, got %v", err)
		require.Empty(t, f.writes())
	})

	t.Run("create of an existing name conflicts", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		f.seed(t, "dry-duplicate")
		_, err := f.storage.Create(f.ctx, newDryRunRule("dry-duplicate", "other"), nil, &metav1.CreateOptions{DryRun: dryRunAll})
		require.ErrorIs(t, err, ngmodels.ErrAlertRuleConflictBase)
		require.Empty(t, f.writes())
	})

	t.Run("create and update still run the store's write checks", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		stored := f.seed(t, "dry-store-checks")
		storeErr := fmt.Errorf("%w: rule group name too long", ngmodels.ErrAlertRuleFailedValidation)
		f.ruleStore.Hook = func(cmd any) error {
			if q, ok := cmd.(fakes.GenericRecordedQuery); ok && q.Name == "ValidateAlertRuleForWrite" {
				return storeErr
			}
			return nil
		}

		_, err := f.storage.Create(f.ctx, newDryRunRule("dry-store-checks-new", "dry"), nil, &metav1.CreateOptions{DryRun: dryRunAll})
		require.True(t, apierrors.IsBadRequest(err), "expected bad request, got %v", err)
		_, _, err = f.storage.Update(f.ctx, stored.Name, k8srest.DefaultUpdatedObjectInfo(stored.DeepCopy()), nil, nil, false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.True(t, apierrors.IsBadRequest(err), "expected bad request, got %v", err)
		require.Empty(t, f.writes())
	})

	t.Run("create still runs createValidation", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		rejected := apierrors.NewBadRequest("rejected by admission")
		_, err := f.storage.Create(f.ctx, newDryRunRule("dry-admission", "dry"), func(context.Context, runtime.Object) error { return rejected }, &metav1.CreateOptions{DryRun: dryRunAll})
		require.ErrorIs(t, err, rejected)
		require.Empty(t, f.writes())
	})

	t.Run("update returns the would-be rule and writes nothing", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		stored := f.seed(t, "dry-update")
		changed := stored.DeepCopy()
		changed.Spec.Title = "changed"

		out, created, err := f.storage.Update(f.ctx, stored.Name, k8srest.DefaultUpdatedObjectInfo(changed), nil, nil, false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)
		require.False(t, created)
		rule := out.(*v1beta1.AlertRule)
		require.Equal(t, "changed", rule.Spec.Title)
		require.Equal(t, stored.UID, rule.UID)
		require.Equal(t, stored.ResourceVersion, rule.ResourceVersion)
		require.Empty(t, f.writes())

		current, err := f.storage.Get(f.ctx, stored.Name, nil)
		require.NoError(t, err)
		require.Equal(t, "original", current.(*v1beta1.AlertRule).Spec.Title)
	})

	t.Run("update still runs the rule service validation", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		stored := f.seed(t, "dry-update-invalid")
		f.validator.err = fmt.Errorf("%w: missing annotations.summary", ngmodels.ErrAlertRuleFailedValidation)

		_, _, err := f.storage.Update(f.ctx, stored.Name, k8srest.DefaultUpdatedObjectInfo(stored.DeepCopy()), nil, nil, false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.True(t, apierrors.IsBadRequest(err), "expected bad request, got %v", err)
		require.Empty(t, f.writes())
	})

	t.Run("PrepareDryRunUpdate applies the request to the stored rule and validates it", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		stored := f.seed(t, "dry-prepare")
		changed := stored.DeepCopy()
		changed.Spec.Title = "changed"

		out, err := f.storage.PrepareDryRunUpdate(f.ctx, stored.Name, k8srest.DefaultUpdatedObjectInfo(changed))
		require.NoError(t, err)
		require.Equal(t, "changed", out.(*v1beta1.AlertRule).Spec.Title)
		require.Empty(t, f.writes())

		f.validator.err = fmt.Errorf("%w: missing annotations.summary", ngmodels.ErrAlertRuleFailedValidation)
		_, err = f.storage.PrepareDryRunUpdate(f.ctx, stored.Name, k8srest.DefaultUpdatedObjectInfo(changed))
		require.True(t, apierrors.IsBadRequest(err), "expected bad request, got %v", err)
		require.Empty(t, f.writes())
	})

	t.Run("delete returns the stored rule and writes nothing", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		stored := f.seed(t, "dry-delete")

		out, _, err := f.storage.Delete(f.ctx, stored.Name, nil, &metav1.DeleteOptions{DryRun: dryRunAll})
		require.NoError(t, err)
		require.Equal(t, stored.Name, out.(*v1beta1.AlertRule).Name)
		require.Empty(t, f.writes())

		_, err = f.storage.Get(f.ctx, stored.Name, nil)
		require.NoError(t, err)
	})

	t.Run("status update returns the new status and writes nothing", func(t *testing.T) {
		f := newDryRunFixture(t, false)
		stored := f.seed(t, "dry-status")
		statusWriter := &recordingStatusWriter{}
		mirrored := false
		status := &statusDualWriter{
			legacy:        f.storage,
			statusWriter:  statusWriter,
			writesUnified: func(context.Context) bool { mirrored = true; return true },
		}
		changed := stored.DeepCopy()
		changed.Status.LastError = new("set by dry run")

		out, _, err := status.Update(f.ctx, stored.Name, k8srest.DefaultUpdatedObjectInfo(changed), nil, nil, false, &metav1.UpdateOptions{DryRun: dryRunAll})
		require.NoError(t, err)
		rule := out.(*v1beta1.AlertRule)
		require.Equal(t, "set by dry run", *rule.Status.LastError)
		require.Equal(t, "original", rule.Spec.Title)
		require.Zero(t, statusWriter.calls)
		require.False(t, mirrored, "a dry run must not mirror the status to unified storage")
	})
}
