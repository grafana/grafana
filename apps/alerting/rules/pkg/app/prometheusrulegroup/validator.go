package prometheusrulegroup

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	prom_model "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
)

func NewValidator(cfg config.RuntimeConfig) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			g, ok := req.Object.(*model.PrometheusRuleGroup)
			if !ok {
				return fmt.Errorf("object is not of type *v0alpha1.PrometheusRuleGroup")
			}

			sourceProv := g.GetProvenanceStatus()
			if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
				return fmt.Errorf("invalid provenance status: %s", sourceProv)
			}

			folderUID := ""
			if g.Annotations != nil {
				folderUID = g.Annotations[model.FolderAnnotationKey]
			}
			// Folder is optional; an empty UID falls through to the root ("General") folder
			// at persist time. Only validate the UID when it's explicitly set.
			if folderUID != "" && cfg.FolderValidator != nil {
				ok, verr := cfg.FolderValidator(ctx, folderUID)
				if verr != nil {
					return fmt.Errorf("failed to validate folder: %w", verr)
				}
				if !ok {
					return fmt.Errorf("folder does not exist: %s", folderUID)
				}
			}

			if g.Spec.Name == "" {
				return fmt.Errorf("group name must be specified")
			}
			if len(g.Spec.Rules) == 0 {
				return fmt.Errorf("group must contain at least one rule")
			}

			if g.Spec.Labels != nil {
				for key := range g.Spec.Labels {
					if _, bad := cfg.ReservedLabelKeys[key]; bad {
						return fmt.Errorf("label key is reserved and cannot be specified: %s", key)
					}
				}
			}

			for i, r := range g.Spec.Rules {
				hasAlert := r.Alert != nil && *r.Alert != ""
				hasRecord := r.Record != nil && *r.Record != ""
				switch {
				case hasAlert && hasRecord:
					return fmt.Errorf("rule[%d]: 'alert' and 'record' are mutually exclusive", i)
				case !hasAlert && !hasRecord:
					return fmt.Errorf("rule[%d]: one of 'alert' or 'record' must be specified", i)
				}
				if r.Expr == "" {
					return fmt.Errorf("rule[%d]: 'expr' must be specified", i)
				}
				if hasRecord {
					metric := prom_model.LabelValue(*r.Record)
					if !metric.IsValid() {
						return fmt.Errorf("rule[%d]: record contains invalid characters", i)
					}
					if !prom_model.IsValidMetricName(metric) { //nolint:staticcheck
						return fmt.Errorf("rule[%d]: invalid metric name in 'record'", i)
					}
				}
				if r.Labels != nil {
					for key := range r.Labels {
						if _, bad := cfg.ReservedLabelKeys[key]; bad {
							return fmt.Errorf("rule[%d]: label key is reserved and cannot be specified: %s", i, key)
						}
					}
				}
			}

			return nil
		},
	}
}
