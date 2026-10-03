package app

import (
	"context"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/simple"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"

	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
)

// New creates the policy app. It only checks the structure of policies and bindings: compiling a
// policy needs the schemas of the kinds it targets, which only the API server's policy admission
// hook has, so the hook rejects policies that fail to compile.
func New(cfg app.Config) (app.App, error) {
	a, err := simple.NewApp(simple.AppConfig{
		Name:       "policy",
		KubeConfig: cfg.KubeConfig,
		ManagedKinds: []simple.AppManagedKind{
			{
				Kind: policyv0alpha1.ValidationPolicyKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(_ context.Context, req *app.AdmissionRequest) error {
						p, ok := req.Object.(*policyv0alpha1.ValidationPolicy)
						if !ok {
							return fmt.Errorf("expected ValidationPolicy, got %T", req.Object)
						}
						return invalid(policyv0alpha1.ValidationPolicyKind().GroupVersionKind().GroupKind(), p.Name, ToPolicy(p).Validate())
					},
				},
			},
			{
				Kind: policyv0alpha1.ValidationPolicyBindingKind(),
				Validator: &simple.Validator{
					ValidateFunc: func(_ context.Context, req *app.AdmissionRequest) error {
						b, ok := req.Object.(*policyv0alpha1.ValidationPolicyBinding)
						if !ok {
							return fmt.Errorf("expected ValidationPolicyBinding, got %T", req.Object)
						}
						return invalid(policyv0alpha1.ValidationPolicyBindingKind().GroupVersionKind().GroupKind(), b.Name, ToBinding(b).Validate())
					},
				},
			},
		},
	})
	if err != nil {
		return nil, err
	}
	if err := a.ValidateManifest(cfg.ManifestData); err != nil {
		return nil, err
	}
	return a, nil
}

func invalid(gk schema.GroupKind, name string, errs field.ErrorList) error {
	if len(errs) == 0 {
		return nil
	}
	return apierrors.NewInvalid(gk, name, prefix(errs))
}

// prefix places structural errors under spec, where the fields live in the resource.
func prefix(errs field.ErrorList) field.ErrorList {
	out := make(field.ErrorList, 0, len(errs))
	for _, e := range errs {
		c := *e
		// The binding name and policy name come from metadata, not spec.
		if c.Field != "name" {
			c.Field = "spec." + c.Field
		} else {
			c.Field = "metadata.name"
		}
		out = append(out, &c)
	}
	return out
}
