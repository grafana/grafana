package recordingrule

import (
	"context"
	"encoding/json"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// ruleStatusWriter persists the serialized status subresource for a single rule.
// Satisfied by *store.DBstore (SaveAlertRuleStatus).
type ruleStatusWriter interface {
	SaveAlertRuleStatus(ctx context.Context, orgID int64, ruleUID string, data []byte) error
}

// statusDualWriter serves the RecordingRule /status subresource. The legacy SQL row
// (alert_rule.k8s_status) is the source of truth: writes persist there and reads
// come from there. Status is also mirrored to unified storage best-effort, because
// the parent dual-writer only writes spec to unified — status updates route here, so
// this mirror is the only way the unified copy's status stays in sync (needed once
// the resource advances past Mode0 for parity metrics and the eventual read-from-
// unified cutover). In Mode0 unified is disabled and the mirror is a silent no-op.
type statusDualWriter struct {
	gv           schema.GroupVersion
	status       *appsdkapiserver.StatusREST
	legacy       *legacyStorage
	statusWriter ruleStatusWriter
}

var (
	_ rest.Patcher             = (*statusDualWriter)(nil)
	_ rest.Storage             = (*statusDualWriter)(nil)
	_ rest.ResetFieldsStrategy = (*statusDualWriter)(nil)
)

// NewStatusStorage builds the RecordingRule /status subresource storage.
func NewStatusStorage(
	legacySvc provisioning.AlertRuleService,
	namespacer request.NamespaceMapper,
	statusWriter ruleStatusWriter,
	unified *appsdkapiserver.StatusREST,
) rest.Storage {
	return &statusDualWriter{
		gv:           ResourceInfo.GroupVersionResource().GroupVersion(),
		status:       unified,
		statusWriter: statusWriter,
		legacy: &legacyStorage{
			service:        legacySvc,
			namespacer:     namespacer,
			tableConverter: rest.NewDefaultTableConvertor(ResourceInfo.GroupResource()),
		},
	}
}

func (s *statusDualWriter) New() runtime.Object { return s.legacy.New() }

func (s *statusDualWriter) Destroy() {}

func (s *statusDualWriter) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	return s.legacy.Get(ctx, name, options)
}

func (s *statusDualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}

	old, err := s.legacy.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}

	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}
	newRule, ok := obj.(*model.RecordingRule)
	if !ok {
		return nil, false, fmt.Errorf("expected RecordingRule but got %T", obj)
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, newRule, old); err != nil {
			return nil, false, err
		}
	}

	data, err := json.Marshal(newRule.Status)
	if err != nil {
		return nil, false, fmt.Errorf("failed to marshal status: %w", err)
	}
	if err := s.statusWriter.SaveAlertRuleStatus(ctx, info.OrgID, name, data); err != nil {
		return nil, false, err
	}

	s.mirrorToUnified(ctx, name, newRule.Status, createValidation, updateValidation, options)

	return newRule, false, nil
}

// mirrorToUnified copies the persisted status onto the unified object, best-effort.
// Legacy is the source of truth. When the object is not in unified storage — Mode0
// (unified disabled) or a best-effort write lag in Mode1 — this is an expected skip,
// so NotFound is swallowed silently; only unexpected errors are logged.
func (s *statusDualWriter) mirrorToUnified(ctx context.Context, name string, status model.RecordingRuleStatus, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, options *metav1.UpdateOptions) {
	unified, err := s.status.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		if !apierrors.IsNotFound(err) {
			logging.FromContext(ctx).Warn("unable to read unified recording rule status for mirroring", "error", err)
		}
		return
	}
	u, ok := unified.(*model.RecordingRule)
	if !ok {
		return
	}
	u.Status = status
	if _, _, err := s.status.Update(ctx, name, rest.DefaultUpdatedObjectInfo(u), createValidation, updateValidation, false, options); err != nil {
		logging.FromContext(ctx).Warn("failed to mirror recording rule status to unified storage", "error", err)
	}
}

func (s *statusDualWriter) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	return map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(s.gv.String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}
}
