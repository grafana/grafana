package legacy

import (
	"bytes"
	"encoding/json"
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

// AlertRuleFromK8s converts an alert rule read from the k8s API into the full domain model. On top of
// AlertRuleFromK8sForWrite, it sets the fields that storage owns: GUID, Version, Updated, UpdatedBy and
// K8sStatus. ID is the SQL row id and has no k8s equivalent, so it stays zero. FolderFullpath comes from
// the folder service and stays empty.
//
// TODO: decide whether Version maps to metadata.generation or to the resourceVersion. Until that is
// settled, the caller passes it in.
func AlertRuleFromK8s(orgID int64, k8sRule *v1beta1.AlertRule, version int64) (*ngmodels.AlertRule, utils.ManagerProperties, error) {
	rule, managerProps, err := AlertRuleFromK8sForWrite(orgID, k8sRule)
	if err != nil {
		return nil, utils.ManagerProperties{}, err
	}
	if err := setStorageManagedFields(rule, k8sRule, k8sRule.Status, version); err != nil {
		return nil, utils.ManagerProperties{}, err
	}
	return rule, managerProps, nil
}

// RecordingRuleFromK8s is the recording rule counterpart of AlertRuleFromK8s.
//
// TODO: decide whether Version maps to metadata.generation or to the resourceVersion. Until that is
// settled, the caller passes it in.
func RecordingRuleFromK8s(orgID int64, k8sRule *v1beta1.RecordingRule, version int64) (*ngmodels.AlertRule, utils.ManagerProperties, error) {
	rule, managerProps, err := RecordingRuleFromK8sForWrite(orgID, k8sRule)
	if err != nil {
		return nil, utils.ManagerProperties{}, err
	}
	if err := setStorageManagedFields(rule, k8sRule, k8sRule.Status, version); err != nil {
		return nil, utils.ManagerProperties{}, err
	}
	return rule, managerProps, nil
}

func setStorageManagedFields(rule *ngmodels.AlertRule, obj runtime.Object, status any, version int64) error {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("failed to get metadata: %w", err)
	}

	rule.GUID = string(meta.GetUID())
	rule.Version = version

	// Unified storage only stamps the updated annotations on updates, so an object that was never
	// updated carries its creation metadata instead.
	updated, err := meta.GetUpdatedTimestamp()
	if err != nil {
		return fmt.Errorf("failed to parse updated timestamp: %w", err)
	}
	if updated != nil {
		rule.Updated = *updated
	} else {
		rule.Updated = meta.GetCreationTimestamp().Time
	}
	updatedBy := meta.GetUpdatedBy()
	if updatedBy == "" {
		updatedBy = meta.GetCreatedBy()
	}
	if updatedBy != "" {
		uid := ngmodels.UserUID(updatedBy)
		rule.UpdatedBy = &uid
	}

	raw, err := json.Marshal(status)
	if err != nil {
		return fmt.Errorf("failed to marshal status: %w", err)
	}
	// An empty status is stored as no status, the same as a rule that was never evaluated.
	if !bytes.Equal(raw, []byte("{}")) {
		rule.K8sStatus = raw
	}
	return nil
}
