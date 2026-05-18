package prometheusrule

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	prom_model "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

func NewValidator(cfg config.RuntimeConfig) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			pr, ok := req.Object.(*model.PrometheusRule)
			if !ok {
				return fmt.Errorf("object is not of type *v0alpha1.PrometheusRule")
			}

			accessor, err := utils.MetaAccessor(pr)
			if err != nil {
				return fmt.Errorf("failed to read object metadata: %w", err)
			}
			if folderUID := accessor.GetFolder(); folderUID != "" && cfg.FolderValidator != nil {
				ok, verr := cfg.FolderValidator(ctx, folderUID)
				if verr != nil {
					return fmt.Errorf("failed to validate folder: %w", verr)
				}
				if !ok {
					return fmt.Errorf("folder does not exist: %s", folderUID)
				}
			}

			if len(pr.Spec.Groups) == 0 {
				return fmt.Errorf("at least one group must be specified")
			}

			groupNames := make(map[string]struct{}, len(pr.Spec.Groups))
			for gIdx, g := range pr.Spec.Groups {
				if g.Name == "" {
					return fmt.Errorf("groups[%d]: name must be specified", gIdx)
				}
				if _, dup := groupNames[g.Name]; dup {
					return fmt.Errorf("groups[%d]: duplicate group name %q in this resource", gIdx, g.Name)
				}
				groupNames[g.Name] = struct{}{}

				if len(g.Rules) == 0 {
					return fmt.Errorf("groups[%d] %q: at least one rule must be specified", gIdx, g.Name)
				}

				if g.Labels != nil {
					for key := range g.Labels {
						if _, bad := cfg.ReservedLabelKeys[key]; bad {
							return fmt.Errorf("groups[%d] %q: label key is reserved and cannot be specified: %s", gIdx, g.Name, key)
						}
					}
				}

				for rIdx, r := range g.Rules {
					hasAlert := r.Alert != nil && *r.Alert != ""
					hasRecord := r.Record != nil && *r.Record != ""
					switch {
					case hasAlert && hasRecord:
						return fmt.Errorf("groups[%d] %q rules[%d]: 'alert' and 'record' are mutually exclusive", gIdx, g.Name, rIdx)
					case !hasAlert && !hasRecord:
						return fmt.Errorf("groups[%d] %q rules[%d]: one of 'alert' or 'record' must be specified", gIdx, g.Name, rIdx)
					}
					if r.Expr == "" {
						return fmt.Errorf("groups[%d] %q rules[%d]: 'expr' must be specified", gIdx, g.Name, rIdx)
					}
					if hasRecord {
						metric := prom_model.LabelValue(*r.Record)
						if !metric.IsValid() {
							return fmt.Errorf("groups[%d] %q rules[%d]: record contains invalid characters", gIdx, g.Name, rIdx)
						}
						if !prom_model.IsValidMetricName(metric) { //nolint:staticcheck
							return fmt.Errorf("groups[%d] %q rules[%d]: invalid metric name in 'record'", gIdx, g.Name, rIdx)
						}
					}
					if r.Labels != nil {
						for key := range r.Labels {
							if _, bad := cfg.ReservedLabelKeys[key]; bad {
								return fmt.Errorf("groups[%d] %q rules[%d]: label key is reserved and cannot be specified: %s", gIdx, g.Name, rIdx, key)
							}
						}
					}
				}
			}

			return nil
		},
	}
}
