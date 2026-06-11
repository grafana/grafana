package alertrule

import (
	"context"
	"fmt"
	"slices"
	"time"

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
func validateGroupLabels(r *model.AlertRule, oldObject resource.Object, action resource.AdmissionAction) error {
	var oldLabels map[string]string
	if oldObject != nil {
		if oldRule, ok := oldObject.(*model.AlertRule); ok {
			oldLabels = oldRule.Labels
		} else {
			return fmt.Errorf("old object is not of type *v0alpha1.AlertRule")
		}
	}
	return util.ValidateGroupLabels(r.Labels, oldLabels, action)
}

func validateDelete(ctx context.Context, req *app.AdmissionRequest, cfg config.RuntimeConfig) error {
	oldRule, ok := req.OldObject.(*model.AlertRule)
	if !ok {
		return fmt.Errorf("old object is not of type *v0alpha1.AlertRule")
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

func validateFolderAndSequenceMembership(ctx context.Context, r *model.AlertRule, oldRule *model.AlertRule, action resource.AdmissionAction, cfg config.RuntimeConfig) error {
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

func validateDurations(r *model.AlertRule) error {
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
}

func NewValidator(cfg config.RuntimeConfig, sv *schemavalidation.SpecValidator) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			// req.Object will not cast to *AlertRule for delete requests,
			// so handle deletes before we attempt to cast it.
			if req.Action == resource.AdmissionActionDelete {
				return validateDelete(ctx, req, cfg)
			}

			r, ok := req.Object.(*model.AlertRule)
			if !ok {
				return fmt.Errorf("object is not of type *v0alpha1.AlertRule")
			}

			// Validate against the openAPI spec first
			if sv != nil {
				if err := sv.ValidateOpenAPISpec(r.Name, r.Spec); err != nil {
					return err
				}
			}
			var oldRule *model.AlertRule
			if req.OldObject != nil {
				oldRule, _ = req.OldObject.(*model.AlertRule)
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

			if r.Spec.NotificationSettings != nil && cfg.NotificationSettingsValidator != nil {
				if err := cfg.NotificationSettingsValidator(ctx, *r.Spec.NotificationSettings); err != nil {
					return fmt.Errorf("notification settings validation error: %w", err)
				}
			}

			if len(r.Spec.Title) > model.AlertRuleMaxTitleLength {
				return fmt.Errorf("alert rule title is too long. Max length is %d", model.AlertRuleMaxTitleLength)
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

			if err := validateDurations(r); err != nil {
				return err
			}

			expressions := make([]util.Expression, 0, len(r.Spec.Expressions))
			for _, expression := range r.Spec.Expressions {
				expressions = append(expressions, &expression)
			}
			return util.ValidateExpressions(expressions)
		},
	}
}
