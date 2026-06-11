package recordingrule

import (
	"context"
	"fmt"
	"slices"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/config"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/schemavalidation"
	"github.com/grafana/grafana/apps/alerting/rules/pkg/app/util"
	prom_model "github.com/prometheus/common/model"
)

// validateGroupLabels now delegates to util.ValidateGroupLabels for shared logic.
func validateGroupLabels(r *model.RecordingRule, oldObject resource.Object, action resource.AdmissionAction) error {
	var oldLabels map[string]string
	if oldObject != nil {
		if oldRule, ok := oldObject.(*model.RecordingRule); ok {
			oldLabels = oldRule.Labels
		} else {
			return fmt.Errorf("old object is not of type *v0alpha1.RecordingRule")
		}
	}
	return util.ValidateGroupLabels(r.Labels, oldLabels, action)
}

func validateDelete(ctx context.Context, req *app.AdmissionRequest, cfg config.RuntimeConfig) error {
	oldRule, ok := req.OldObject.(*model.RecordingRule)
	if !ok {
		return fmt.Errorf("old object is not of type *v0alpha1.RecordingRule")
	}
	if cfg.MembershipResolver != nil {
		memberships, err := cfg.MembershipResolver.Resolve(ctx, []string{oldRule.Name})
		if err != nil {
			return fmt.Errorf("failed to resolve sequence membership for rule %q: %w", oldRule.Name, err)
		}
		if memberships[oldRule.Name].Found {
			return fmt.Errorf("cannot delete rule %q because it belongs to rule sequence %q", oldRule.Name, memberships[oldRule.Name].SequenceUID)
		}
	}
	return nil
}

func validateFolderAndSequenceMembership(ctx context.Context, r *model.RecordingRule, oldRule *model.RecordingRule, action resource.AdmissionAction, cfg config.RuntimeConfig) error {
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

	if action == resource.AdmissionActionUpdate && oldRule != nil && cfg.MembershipResolver != nil {
		oldFolderUID := ""
		if oldRule.Annotations != nil {
			oldFolderUID = oldRule.Annotations[model.FolderAnnotationKey]
		}
		if oldFolderUID != folderUID {
			memberships, err := cfg.MembershipResolver.Resolve(ctx, []string{r.Name})
			if err != nil {
				return fmt.Errorf("failed to resolve sequence membership for rule %q: %w", r.Name, err)
			}
			if memberships[r.Name].Found {
				return fmt.Errorf("cannot move rule %q to folder %q because it belongs to rule sequence %q", r.Name, folderUID, memberships[r.Name].SequenceUID)
			}
		}
	}
	return nil
}

func validateMetric(r *model.RecordingRule) error {
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
}

func NewValidator(cfg config.RuntimeConfig, sv *schemavalidation.SpecValidator) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			// req.Object will not cast to *RecordingRule for delete requests,
			// so handle deletes before we attempt to cast it.
			if req.Action == resource.AdmissionActionDelete {
				return validateDelete(ctx, req, cfg)
			}

			r, ok := req.Object.(*model.RecordingRule)
			if !ok {
				return fmt.Errorf("object is not of type *v0alpha1.RecordingRule")
			}

			// Validate against the openAPI spec first
			if sv != nil {
				if err := sv.ValidateOpenAPISpec(r.Name, r.Spec); err != nil {
					return err
				}
			}
			var oldRule *model.RecordingRule
			if req.OldObject != nil {
				oldRule, _ = req.OldObject.(*model.RecordingRule)
			}

			sourceProv := r.GetProvenanceStatus()
			if !slices.Contains(model.AcceptedProvenanceStatuses, sourceProv) {
				return fmt.Errorf("invalid provenance status: %s", sourceProv)
			}

			if err := validateGroupLabels(r, req.OldObject, req.Action); err != nil {
				return err
			}

			if err := validateFolderAndSequenceMembership(ctx, r, oldRule, req.Action, cfg); err != nil {
				return err
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

			expressions := make([]util.Expression, 0, len(r.Spec.Expressions))
			for _, expression := range r.Spec.Expressions {
				expressions = append(expressions, &expression)
			}
			if err := util.ValidateExpressions(expressions); err != nil {
				return err
			}

			return validateMetric(r)
		},
	}
}
