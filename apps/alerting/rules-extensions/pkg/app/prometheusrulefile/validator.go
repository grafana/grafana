package prometheusrulefile

import (
	"context"
	"fmt"
	"regexp"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	prom_model "github.com/prometheus/common/model"

	model "github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/apis/rulesextensions/v0alpha1"
	"github.com/grafana/grafana/apps/alerting/rules-extensions/pkg/app/config"
)

// metricNameRe matches the Prometheus metric name format. Used to validate the `record` field
// of recording rule entries before the reconciler maps them to RecordingRule resources.
var metricNameRe = regexp.MustCompile(`^[a-zA-Z_:][a-zA-Z0-9_:]*$`)

// NewValidator builds the admission validator for PrometheusRuleFile.
// It enforces:
//   - the parent folder annotation is set (and exists, if a FolderValidator is configured)
//   - groups have unique names within a file and at least one rule
//   - each rule entry is either alerting (alert+expr) or recording (record+expr), not both
//   - durations and metric names parse correctly
func NewValidator(cfg config.RuntimeConfig) *simple.Validator {
	return &simple.Validator{
		ValidateFunc: func(ctx context.Context, req *app.AdmissionRequest) error {
			f, ok := req.Object.(*model.PrometheusRuleFile)
			if !ok {
				return fmt.Errorf("object is not of type *v0alpha1.PrometheusRuleFile")
			}

			folderUID := f.GetParentFolderUID()
			if folderUID == "" {
				return fmt.Errorf("annotation %q is required and must point to the parent folder UID", model.FolderAnnotationKey)
			}
			if cfg.FolderValidator != nil {
				ok, verr := cfg.FolderValidator(ctx, folderUID)
				if verr != nil {
					return fmt.Errorf("failed to validate folder: %w", verr)
				}
				if !ok {
					return fmt.Errorf("parent folder does not exist: %s", folderUID)
				}
			}

			// Resolve the datasource UID we'd reconcile against and, if a validator was
			// supplied, confirm it exists at admission time. Without this check a file with
			// no DatasourceUID would happily admit on an on-prem stack and silently fall
			// through to the "grafanacloud-prom" fallback at reconcile, where every rule
			// would fail to evaluate.
			datasourceUID, derr := resolveDatasourceUIDForFile(ctx, cfg, f)
			if derr != nil {
				return fmt.Errorf("failed to resolve datasource UID: %w", derr)
			}
			if cfg.DatasourceValidator != nil {
				ok, verr := cfg.DatasourceValidator(ctx, datasourceUID)
				if verr != nil {
					return fmt.Errorf("failed to validate datasource: %w", verr)
				}
				if !ok {
					return fmt.Errorf("datasource does not exist: %s", datasourceUID)
				}
			}

			if len(f.Spec.Groups) == 0 {
				return fmt.Errorf("at least one group is required")
			}

			seen := make(map[string]struct{}, len(f.Spec.Groups))
			for gi, g := range f.Spec.Groups {
				if g.Name == "" {
					return fmt.Errorf("group[%d]: name is required", gi)
				}
				if _, dup := seen[g.Name]; dup {
					return fmt.Errorf("duplicate group name: %s", g.Name)
				}
				seen[g.Name] = struct{}{}

				if err := validateOptionalDuration("group["+g.Name+"].interval", g.Interval); err != nil {
					return err
				}
				if err := validateOptionalDuration("group["+g.Name+"].queryOffset", g.QueryOffset); err != nil {
					return err
				}

				// Reject the Prometheus `limit` field. It caps the number of alerts a group
				// may produce per evaluation, but Grafana's alerting engine has no equivalent
				// — the prom convert API (pkg/services/ngalert/prom) rejects it for the same
				// reason. Accepting it silently would mislead users into thinking it took
				// effect.
				if g.Limit != nil && *g.Limit > 0 {
					return fmt.Errorf("group[%s]: limit is not supported", g.Name)
				}

				if len(g.Rules) == 0 {
					return fmt.Errorf("group[%s]: at least one rule is required", g.Name)
				}
				for ri, r := range g.Rules {
					if err := validateRuleEntry(g.Name, ri, r); err != nil {
						return err
					}
				}
			}
			return nil
		},
	}
}

func validateRuleEntry(group string, idx int, r model.PrometheusRuleFileRuleEntry) error {
	loc := fmt.Sprintf("group[%s].rules[%d]", group, idx)
	if r.Expr == "" {
		return fmt.Errorf("%s: expr is required", loc)
	}
	hasAlert := r.Alert != nil && *r.Alert != ""
	hasRecord := r.Record != nil && *r.Record != ""
	switch {
	case hasAlert && hasRecord:
		return fmt.Errorf("%s: rule cannot be both alerting (alert) and recording (record)", loc)
	case !hasAlert && !hasRecord:
		return fmt.Errorf("%s: rule must set either alert or record", loc)
	case hasRecord:
		if !metricNameRe.MatchString(*r.Record) {
			return fmt.Errorf("%s: record %q is not a valid metric name", loc, *r.Record)
		}
		// `for` and `keepFiringFor` only apply to alerting rules.
		if r.For != nil || r.KeepFiringFor != nil {
			return fmt.Errorf("%s: 'for' and 'keepFiringFor' are not valid on recording rules", loc)
		}
	}
	if err := validateOptionalDuration(loc+".for", r.For); err != nil {
		return err
	}
	if err := validateOptionalDuration(loc+".keepFiringFor", r.KeepFiringFor); err != nil {
		return err
	}
	return nil
}

func validateOptionalDuration(field string, d *model.PrometheusRuleFilePromDuration) error {
	if d == nil {
		return nil
	}
	if _, err := prom_model.ParseDuration(string(*d)); err != nil {
		return fmt.Errorf("%s: invalid duration %q: %w", field, string(*d), err)
	}
	return nil
}
