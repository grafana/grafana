package alertrule

import (
	"context"
	"fmt"
	"slices"
	"strconv"
	"time"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/util"
	prom_model "github.com/prometheus/common/model"
)

func NewValidator(cfg config.RuntimeConfig) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			// Cast to specific type
			r, ok := req.Object.(*model.AlertRule)
			if !ok {
				return fmt.Errorf("object is not of type *v0alpha1.AlertRule")
			}

			// 1) Validate provenance status annotation
			sourceProv := r.GetProvenanceStatus()
			if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
				return fmt.Errorf("invalid provenance status: %s", sourceProv)
			}

			// 2) Validate group labels rules
			group := r.Labels[model.GroupLabelKey]
			groupIndexStr := r.Labels[model.GroupIndexLabelKey]
			if req.Action == resource.AdmissionActionCreate {
				if group != "" || groupIndexStr != "" {
					return fmt.Errorf("cannot set group when creating alert rule")
				}
			}
			if group != "" { // if group is set, group-index must be set and numeric
				if groupIndexStr == "" {
					return fmt.Errorf("%s must be set when %s is set", model.GroupIndexLabelKey, model.GroupLabelKey)
				}
				if _, err := strconv.Atoi(groupIndexStr); err != nil {
					return fmt.Errorf("invalid %s: %w", model.GroupIndexLabelKey, err)
				}
			}

			// 3) Validate folder is set and exists
			// Read folder UID directly from annotations
			folderUID := ""
			if r.Annotations != nil {
				folderUID = r.Annotations[model.FolderAnnotationKey]
			}
			if folderUID == "" {
				return fmt.Errorf("folder is required")
			}
			if cfg.FolderValidator != nil {
				ok, verr := cfg.FolderValidator(ctx, folderUID)
				if verr != nil {
					return fmt.Errorf("failed to validate folder: %w", verr)
				}
				if !ok {
					return fmt.Errorf("folder does not exist: %s", folderUID)
				}
			}

			// 4) Validate notification settings receiver if provided
			if r.Spec.NotificationSettings != nil && r.Spec.NotificationSettings.Receiver != "" && cfg.NotificationSettingsValidator != nil {
				ok, nerr := cfg.NotificationSettingsValidator(ctx, r.Spec.NotificationSettings.Receiver)
				if nerr != nil {
					return fmt.Errorf("failed to validate notification settings: %w", nerr)
				}
				if !ok {
					return fmt.Errorf("invalid notification receiver: %s", r.Spec.NotificationSettings.Receiver)
				}
			}

			// 5) Enforce max title length
			if len(r.Spec.Title) > model.AlertRuleMaxTitleLength {
				return fmt.Errorf("alert rule title is too long. Max length is %d", model.AlertRuleMaxTitleLength)
			}

			// 6) Validate evaluation interval against base interval
			if err := util.ValidateInterval(cfg.BaseEvaluationInterval, &r.Spec.Trigger.Interval); err != nil {
				return err
			}

			// 7) Disallow reserved/spec system label keys
			if r.Spec.Labels != nil {
				for key := range r.Spec.Labels {
					if _, bad := cfg.ReservedLabelKeys[key]; bad {
						return fmt.Errorf("label key is reserved and cannot be specified: %s", key)
					}
				}
			}

			// 8) For and KeepFiringFor must be >= 0 if set
			if r.Spec.For != nil {
				d, err := prom_model.ParseDuration(*r.Spec.For)
				if err != nil {
					return fmt.Errorf("invalid 'for' duration: %w", err)
				}
				if time.Duration(d) < 0 {
					return fmt.Errorf("'for' cannot be less than 0")
				}
			}
			if r.Spec.KeepFiringFor != nil {
				d, err := prom_model.ParseDuration(*r.Spec.KeepFiringFor)
				if err != nil {
					return fmt.Errorf("invalid 'keepFiringFor' duration: %w", err)
				}
				if time.Duration(d) < 0 {
					return fmt.Errorf("'keepFiringFor' cannot be less than 0")
				}
			}

			return nil
		},
	}
}
