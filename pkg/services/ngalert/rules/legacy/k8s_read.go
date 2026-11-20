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
// Version is metadata.generation, not the resourceVersion: unified storage bumps the resourceVersion on
// every write, status included, but the generation only when the spec, folder or deletion state changes.
// Unlike the SQL version, the generation does not change when only labels change, such as the rule group
// or its index.
func AlertRuleFromK8s(orgID int64, k8sRule *v1beta1.AlertRule) (*ngmodels.AlertRule, utils.ManagerProperties, error) {
	rule, managerProps, err := AlertRuleFromK8sForWrite(orgID, k8sRule)
	if err != nil {
		return nil, utils.ManagerProperties{}, err
	}
	if err := setStorageManagedFields(rule, k8sRule, k8sRule.Status); err != nil {
		return nil, utils.ManagerProperties{}, err
	}
	return rule, managerProps, nil
}

// RecordingRuleFromK8s is the recording rule counterpart of AlertRuleFromK8s.
func RecordingRuleFromK8s(orgID int64, k8sRule *v1beta1.RecordingRule) (*ngmodels.AlertRule, utils.ManagerProperties, error) {
	rule, managerProps, err := RecordingRuleFromK8sForWrite(orgID, k8sRule)
	if err != nil {
		return nil, utils.ManagerProperties{}, err
	}
	if err := setStorageManagedFields(rule, k8sRule, k8sRule.Status); err != nil {
		return nil, utils.ManagerProperties{}, err
	}
	return rule, managerProps, nil
}

func setStorageManagedFields(rule *ngmodels.AlertRule, obj runtime.Object, status any) error {
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return fmt.Errorf("failed to get metadata: %w", err)
	}

	rule.GUID = string(meta.GetUID())
	rule.Version = meta.GetGeneration()

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
