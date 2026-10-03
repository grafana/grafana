package app

import (
	"context"
	"fmt"
	"regexp"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation"
	"k8s.io/apimachinery/pkg/util/validation/field"

	"github.com/grafana/grafana/apps/policy/pkg/managed"

	foldernamingv0alpha1 "github.com/grafana/grafana/apps/foldernaming/pkg/apis/foldernaming/v0alpha1"
)

// New creates the folder naming app. A FolderNamingPolicy describes a naming convention for folder
// titles; the reconciler turns each one into a validation policy and binding that the API server's
// policy admission hook evaluates on every folder write.
func New(cfg app.Config) (app.App, error) {
	cfg.KubeConfig.APIPath = "/apis"
	clients, err := managed.NewClients(cfg.KubeConfig)
	if err != nil {
		return nil, err
	}

	a, err := simple.NewApp(simple.AppConfig{
		Name:       "foldernaming",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{{
			Kind: foldernamingv0alpha1.FolderNamingPolicyKind(),
			Validator: &simple.Validator{
				ValidateFunc: func(_ context.Context, req *app.AdmissionRequest) error {
					p, ok := req.Object.(*foldernamingv0alpha1.FolderNamingPolicy)
					if !ok {
						return fmt.Errorf("expected FolderNamingPolicy, got %T", req.Object)
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

func validate(p *foldernamingv0alpha1.FolderNamingPolicy) error {
	var errs field.ErrorList
	if maxLen := validation.DNS1123SubdomainMaxLength - len(namePrefix); len(p.Name) > maxLen {
		// The policy and binding enforcing the FolderNamingPolicy are named after it.
		errs = append(errs, field.TooLong(field.NewPath("metadata", "name"), p.Name, maxLen))
	}
	switch p.Spec.Enforcement {
	case foldernamingv0alpha1.FolderNamingPolicyEnforcementDeny, foldernamingv0alpha1.FolderNamingPolicyEnforcementWarn:
	default:
		errs = append(errs, field.NotSupported(field.NewPath("spec", "enforcement"), p.Spec.Enforcement,
			[]foldernamingv0alpha1.FolderNamingPolicyEnforcement{foldernamingv0alpha1.FolderNamingPolicyEnforcementDeny, foldernamingv0alpha1.FolderNamingPolicyEnforcementWarn}))
	}
	patternPath := field.NewPath("spec", "titlePattern")
	if p.Spec.TitlePattern == "" {
		errs = append(errs, field.Required(patternPath, ""))
	} else if _, err := regexp.Compile(p.Spec.TitlePattern); err != nil {
		// CEL's matches() uses RE2, as Go's regexp does, so a pattern that compiles here compiles there.
		errs = append(errs, field.Invalid(patternPath, p.Spec.TitlePattern, err.Error()))
	}
	if len(errs) == 0 {
		return nil
	}
	return apierrors.NewInvalid(foldernamingv0alpha1.FolderNamingPolicyKind().GroupVersionKind().GroupKind(), p.Name, errs)
}
