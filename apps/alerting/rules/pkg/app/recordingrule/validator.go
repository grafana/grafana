package recordingrule

import (
	"context"
	"fmt"
	"slices"
	"strconv"

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
			r, ok := req.Object.(*model.RecordingRule)
			if !ok {
				return fmt.Errorf("object is not of type *v0alpha1.RecordingRule")
			}

			sourceProv := r.GetProvenanceStatus()
			if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
				return fmt.Errorf("invalid provenance status: %s", sourceProv)
			}

			group := r.Labels[model.GroupLabelKey]
			groupIndexStr := r.Labels[model.GroupIndexLabelKey]
			if req.Action == resource.AdmissionActionCreate {
				if group != "" || groupIndexStr != "" {
					return fmt.Errorf("cannot set group when creating recording rule")
				}
			}
			if group != "" {
				if groupIndexStr == "" {
					return fmt.Errorf("%s must be set when %s is set", model.GroupIndexLabelKey, model.GroupLabelKey)
				}
				if _, err := strconv.Atoi(groupIndexStr); err != nil {
					return fmt.Errorf("invalid %s: %w", model.GroupIndexLabelKey, err)
				}
			}

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

			if len(r.Spec.Title) > model.AlertRuleMaxTitleLength {
				return fmt.Errorf("recording rule title is too long. Max length is %d", model.AlertRuleMaxTitleLength)
			}

			if err := util.ValidateInterval(cfg.BaseEvaluationInterval, &r.Spec.Trigger.Interval); err != nil {
				return err
			}

			if r.Spec.Labels != nil {
				for key := range r.Spec.Labels {
					if _, bad := cfg.ReservedLabelKeys[key]; bad {
						return fmt.Errorf("label key is reserved and cannot be specified: %s", key)
					}
				}
			}

			if r.Spec.Metric == "" {
				return fmt.Errorf("metric must be specified")
			}
			metric := prom_model.LabelValue(r.Spec.Metric)
			if !metric.IsValid() {
				return fmt.Errorf("metric contains invalid characters")
			}
			if !prom_model.IsValidMetricName(metric) { // nolint:staticcheck
				return fmt.Errorf("invalid metric name")
			}

			return nil
		},
	}
}
