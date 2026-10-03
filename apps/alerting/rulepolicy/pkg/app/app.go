package app

import (
	"context"
	"fmt"
	"strings"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana/apps/policy/pkg/managed"

	rulepolicyv0alpha1 "github.com/grafana/grafana/apps/alerting/rulepolicy/pkg/apis/rulepolicy/v0alpha1"
)

// New creates the rule policy app. A RulePolicy is the simple, user-facing description of what
// alert rules must carry; the reconciler turns each one into validation policies and bindings that
// the API server's policy admission hook evaluates on every alert rule write.
func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "/apis"
	clients, err := managed.NewClients(cfg.KubeConfig)
	if err != nil {
		return nil, err
	}

	a, err := simple.NewApp(simple.AppConfig{
		Name:       "rulepolicy",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{{
			Kind: rulepolicyv0alpha1.RulePolicyKind(),
			Validator: &simple.Validator{
				ValidateFunc: func(_ context.Context, req *app.AdmissionRequest) error {
					p, ok := req.Object.(*rulepolicyv0alpha1.RulePolicy)
					if !ok {
						return fmt.Errorf("expected RulePolicy, got %T", req.Object)
					}
					return validate(p)
				},
			},
			Reconciler: NewReconciler(clients),
		}},
	})
	if err != nil {
		return nil, err
	}
	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}
	return a, nil
}

func validate(p *rulepolicyv0alpha1.RulePolicy) error {
	var errs field.ErrorList
	if maxLen := validation.DNS1123SubdomainMaxLength - len(namePrefix); len(p.Name) > maxLen {
		// The policy and binding enforcing the RulePolicy are named after it.
		errs = append(errs, field.TooLong(field.NewPath("metadata", "name"), p.Name, maxLen))
	}
	switch p.Spec.Enforcement {
	case rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicyEnforcementWarn:
	default:
		errs = append(errs, field.NotSupported(field.NewPath("spec", "enforcement"), p.Spec.Enforcement,
			[]rulepolicyv0alpha1.RulePolicyEnforcement{rulepolicyv0alpha1.RulePolicyEnforcementDeny, rulepolicyv0alpha1.RulePolicyEnforcementWarn}))
	}
	spec := field.NewPath("spec")
	errs = append(errs, validateKeys(p.Spec.RequiredLabels, p.Spec.ForbiddenLabels, spec.Child("requiredLabels"), spec.Child("forbiddenLabels"))...)
	errs = append(errs, validateKeys(p.Spec.RequiredAnnotations, p.Spec.ForbiddenAnnotations, spec.Child("requiredAnnotations"), spec.Child("forbiddenAnnotations"))...)
	if len(errs) == 0 {
		return nil
	}
	return apierrors.NewInvalid(rulepolicyv0alpha1.RulePolicyKind().GroupVersionKind().GroupKind(), p.Name, errs)
}

// validateKeys checks that keys are non-blank and unique, and that no key is both required and
// forbidden, which no rule could satisfy.
func validateKeys(required, forbidden []string, requiredPath, forbiddenPath *field.Path) field.ErrorList {
	errs := uniqueKeys(required, requiredPath)
	errs = append(errs, uniqueKeys(forbidden, forbiddenPath)...)
	req := map[string]struct{}{}
	for _, k := range required {
		req[strings.TrimSpace(k)] = struct{}{}
	}
	for i, k := range forbidden {
		if _, ok := req[strings.TrimSpace(k)]; ok && strings.TrimSpace(k) != "" {
			errs = append(errs, field.Invalid(forbiddenPath.Index(i), k, "a key cannot be both required and forbidden"))
		}
	}
	return errs
}

func uniqueKeys(keys []string, path *field.Path) field.ErrorList {
	var errs field.ErrorList
	seen := map[string]struct{}{}
	for i, k := range keys {
		k = strings.TrimSpace(k)
		if k == "" {
			errs = append(errs, field.Required(path.Index(i), ""))
			continue
		}
		if _, ok := seen[k]; ok {
			errs = append(errs, field.Duplicate(path.Index(i), k))
		}
		seen[k] = struct{}{}
	}
	return errs
}
