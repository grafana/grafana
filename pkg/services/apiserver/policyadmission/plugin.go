// Package policyadmission evaluates the validation policies of the policy.grafana.app API on
// every write to an app platform resource.
package policyadmission

import (
	"context"
	"errors"
	"fmt"

	"github.com/grafana/grafana-app-sdk/app"
	appsdkapiserver "github.com/grafana/grafana-app-sdk/k8s/apiserver"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/admission"
	"k8s.io/apiserver/pkg/cel/openapi/resolver"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"

	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
	policyapp "github.com/grafana/grafana/apps/policy/pkg/app"
	"github.com/grafana/grafana/pkg/infra/log"
	policyadmission "github.com/grafana/grafana/pkg/policy/admission"
	"github.com/grafana/grafana/pkg/policy/engine"
	"github.com/grafana/grafana/pkg/policy/schema"
	"github.com/grafana/grafana/pkg/policy/schema/manifest"
)

// PostStartHookName names the hook that starts watching policies.
const PostStartHookName = "validation-policy-admission"

// Plugin evaluates validation policies on writes, and rejects ValidationPolicy writes that do
// not compile against the schemas of the kinds they target.
type Plugin struct {
	*admission.Handler
	store    *store
	evaluate *policyadmission.Plugin
}

var _ admission.ValidationInterface = (*Plugin)(nil)

// New builds the plugin. Policies are type-checked against the schemas in the installed apps'
// manifests, and against the server's OpenAPI definitions for kinds served by API builders
// (such as folders and dashboards), which have no manifest.
func New(installers []appsdkapiserver.AppInstaller, definitions common.GetOpenAPIDefinitions, scheme *runtime.Scheme) *Plugin {
	logger := log.New("validation-policy-admission")
	manifests := make([]app.ManifestData, 0, len(installers))
	for _, i := range installers {
		if md := i.ManifestData(); md != nil {
			manifests = append(manifests, *md)
		}
	}
	manifestResolver, err := manifest.NewResolver(manifests...)
	if err != nil {
		// Only the kinds whose schemas failed to convert are unavailable to policies.
		logger.Warn("Some app schemas cannot be used by validation policies", "error", err)
	}
	schemas := schema.Combine(manifestResolver, resolver.NewDefinitionsSchemaResolver(definitions, scheme))
	st := newStore(logger, engine.NewCompiler(schema.NewCachingResolver(schemas)), manifest.Resources(manifests...))
	return &Plugin{
		Handler:  admission.NewHandler(admission.Create, admission.Update, admission.Delete),
		store:    st,
		evaluate: policyadmission.NewPlugin(st),
	}
}

// PostStartHook starts watching policies once the loopback client is available.
func (p *Plugin) PostStartHook(hookCtx genericapiserver.PostStartHookContext) error {
	return p.store.start(hookCtx.Context, hookCtx.LoopbackClientConfig)
}

func (p *Plugin) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	if a.GetKind().Group == policyv0alpha1.APIGroup {
		// Policies never apply to the policy API itself, so that a broken policy cannot block
		// the write that fixes it.
		if a.GetKind().Kind == policyv0alpha1.ValidationPolicyKind().Kind() && a.GetSubresource() == "" && a.GetOperation() != admission.Delete {
			return p.checkCompiles(a)
		}
		return nil
	}
	return p.evaluate.Validate(ctx, a, o)
}

func (p *Plugin) checkCompiles(a admission.Attributes) error {
	vp, ok := a.GetObject().(*policyv0alpha1.ValidationPolicy)
	if !ok {
		return apierrors.NewInternalError(fmt.Errorf("expected ValidationPolicy, got %T", a.GetObject()))
	}
	policy := policyapp.ToPolicy(vp)
	if len(policy.Validate()) > 0 {
		// Structural errors are reported by the policy app's own validator.
		return nil
	}
	_, err := p.store.compile(policy)
	var cerr *engine.CompileError
	if !errors.As(err, &cerr) {
		return err
	}
	errs := make(field.ErrorList, 0, len(cerr.Errors))
	for _, e := range cerr.Errors {
		msg := e.Err.Error()
		if !e.GVK.Empty() {
			msg = fmt.Sprintf("%s: %s", e.GVK, msg)
		}
		errs = append(errs, field.Invalid(field.NewPath("spec").Child(e.Path), nil, msg))
	}
	return apierrors.NewInvalid(a.GetKind().GroupKind(), a.GetName(), errs)
}
