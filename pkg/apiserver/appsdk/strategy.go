package appsdk

import (
	"context"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage/names"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
)

// StrategyOptions tune the storage strategies of an installer's kinds. The zero value keeps the app-sdk defaults.
type StrategyOptions struct {
	// AllowCreateOnUpdate and AllowUnconditionalUpdate give kinds the semantics of Grafana's registry stores:
	// a conditional update of a missing object surfaces as a Conflict from storage, and updates by name need no resourceVersion.
	AllowCreateOnUpdate      bool
	AllowUnconditionalUpdate bool
	// ValidateSpecOnStatusUpdate lets a status write carry its spec, so admission validates it instead of the
	// spec being silently replaced with the stored one.
	ValidateSpecOnStatusUpdate bool
	// ResetStatusOnCreate selects the kinds that start with generation 1 and a zero status, ignoring the status the
	// client sent, as Grafana's registry stores do. Other kinds keep the status they are created with.
	ResetStatusOnCreate func(kind string) bool
}

type strategy struct {
	ObjectTyper runtime.ObjectTyper
	kind        resource.Kind
	namer       names.NameGenerator
	opts        StrategyOptions
}

func newStrategy(scheme *runtime.Scheme, kind resource.Kind, opts StrategyOptions) *strategy {
	return &strategy{
		ObjectTyper: scheme,
		kind:        kind,
		namer:       names.SimpleNameGenerator,
		opts:        opts,
	}
}

func (s *strategy) NamespaceScoped() bool {
	return s.kind.Scope() == resource.NamespacedScope
}

func (s *strategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(s.kind.GroupVersionKind().GroupVersion().String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("status"),
		),
	}
	return fields
}

func (s *strategy) GenerateName(base string) string {
	return s.namer.GenerateName(base)
}

func (s *strategy) PrepareForCreate(_ context.Context, obj runtime.Object) {
	if s.opts.ResetStatusOnCreate == nil || !s.opts.ResetStatusOnCreate(s.kind.Kind()) {
		return
	}
	o, ok := obj.(resource.Object)
	if !ok {
		return
	}
	o.SetGeneration(1)
	if status, ok := s.kind.ZeroValue().GetSubresource(string(resource.SubresourceStatus)); ok {
		_ = o.SetSubresource(string(resource.SubresourceStatus), status)
	}
}

func (*strategy) Validate(_ context.Context, _ runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

func (*strategy) Canonicalize(_ runtime.Object) {
}

func (s *strategy) AllowCreateOnUpdate(_ context.Context) bool {
	return s.opts.AllowCreateOnUpdate
}

func (*strategy) WarningsOnCreate(_ context.Context, _ runtime.Object) []string {
	return nil
}

func (*strategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	if obj == nil || old == nil {
		return
	}
	newObj, ok1 := obj.(resource.Object)
	oldObj, ok2 := old.(resource.Object)
	if !ok1 || !ok2 {
		logging.FromContext(ctx).Error("PrepareForUpdate called with non-resource.Object object")
		return
	}
	status, ok := oldObj.GetSubresource(string(resource.SubresourceStatus))
	if ok {
		err := newObj.SetSubresource(string(resource.SubresourceStatus), status)
		if err != nil {
			logging.FromContext(ctx).Error("PrepareForUpdate set status error", "error", err)
		}
	}
}

func (*strategy) ValidateUpdate(_ context.Context, _, _ runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

func (s *strategy) AllowUnconditionalUpdate(_ context.Context) bool {
	return s.opts.AllowUnconditionalUpdate
}

func (*strategy) WarningsOnUpdate(_ context.Context, _, _ runtime.Object) []string {
	return nil
}

func (*strategy) PrepareForDelete(_ context.Context, _ runtime.Object) {
}

func (*strategy) WarningsOnDelete(_ context.Context, _ runtime.Object) []string {
	return nil
}

func (s *strategy) ObjectKinds(obj runtime.Object) ([]schema.GroupVersionKind, bool, error) {
	return s.ObjectTyper.ObjectKinds(obj)
}

func (s *strategy) Recognizes(gvk schema.GroupVersionKind) bool {
	return gvk == s.kind.GroupVersionKind()
}

func (*strategy) CheckGracefulDelete(_ context.Context, _ runtime.Object, _ *metav1.DeleteOptions) bool {
	return false
}

var _ rest.Scoper = &strategy{}
var _ rest.RESTCreateStrategy = &strategy{}
var _ rest.RESTUpdateStrategy = &strategy{}
var _ rest.RESTDeleteStrategy = &strategy{}
var _ rest.RESTGracefulDeleteStrategy = &strategy{}

// genericStatusStrategy allows for writing objects with status fields, however may not create them.
// It ignores spec and metadata fields, and does not allow for updates outside of the status field.
type genericStatusStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator

	gv         schema.GroupVersion
	namespaced bool
	opts       StrategyOptions
}

// NewStatusStrategy creates a new genericStatusStrategy.
func newStatusStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion, namespaced bool, opts StrategyOptions) *genericStatusStrategy {
	return &genericStatusStrategy{typer, names.SimpleNameGenerator, gv, namespaced, opts}
}

func (g *genericStatusStrategy) NamespaceScoped() bool {
	return g.namespaced
}

func (g *genericStatusStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(g.gv.String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}

	return fields
}

func (g *genericStatusStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	if obj == nil || old == nil {
		return
	}
	oldObj, ok1 := old.(resource.Object)
	newObj, ok2 := obj.(resource.Object)
	if !ok1 || !ok2 {
		logging.FromContext(ctx).Error("Status PrepareForUpdate called with non-resource.Object object")
		return
	}
	newObj.SetAnnotations(oldObj.GetAnnotations())
	newObj.SetLabels(oldObj.GetLabels())
	newObj.SetFinalizers(oldObj.GetFinalizers())
	newObj.SetOwnerReferences(oldObj.GetOwnerReferences())
	if g.opts.ValidateSpecOnStatusUpdate {
		return
	}
	// TODO: we shouldn't have to do this, right? It's not being done in OSS grafana, but we lose the spec otherwise here...
	err := newObj.SetSpec(oldObj.GetSpec())
	if err != nil {
		logging.FromContext(ctx).Error("Status PrepareForUpdate set spec error", "error", err)
	}
}

func (*genericStatusStrategy) AllowCreateOnUpdate(_ context.Context) bool {
	return false
}

func (*genericStatusStrategy) AllowUnconditionalUpdate(_ context.Context) bool {
	return false
}

// Canonicalize normalizes the object after validation.
func (*genericStatusStrategy) Canonicalize(_ runtime.Object) {
}

// ValidateUpdate validates an update of genericStatusStrategy.
func (*genericStatusStrategy) ValidateUpdate(_ context.Context, _, _ runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (*genericStatusStrategy) WarningsOnUpdate(_ context.Context, _, _ runtime.Object) []string {
	return nil
}

// genericStatusStrategy allows for writing objects with status fields, however may not create them.
// It ignores spec and metadata fields, and does not allow for updates outside of the subresource field.
type genericSubresourceStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator

	gv          schema.GroupVersion
	subresource string
	resetFields []string
	namespaced  bool
}

// NewSubresourceStrategy creates a new genericStatusStrategy.
func newSubresourceStrategy(typer runtime.ObjectTyper, gv schema.GroupVersion, subresource string, resetFields []string, namespaced bool) *genericSubresourceStrategy {
	return &genericSubresourceStrategy{
		ObjectTyper:   typer,
		NameGenerator: names.SimpleNameGenerator,
		gv:            gv,
		subresource:   subresource,
		resetFields:   resetFields,
		namespaced:    namespaced,
	}
}

func (g *genericSubresourceStrategy) NamespaceScoped() bool {
	return g.namespaced
}

func (g *genericSubresourceStrategy) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	paths := make([]fieldpath.Path, 0, len(g.resetFields))
	for _, path := range g.resetFields {
		paths = append(paths, fieldpath.MakePathOrDie(path))
	}
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(g.gv.String()): fieldpath.NewSet(paths...),
	}

	return fields
}

func (g *genericSubresourceStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	if obj == nil || old == nil {
		return
	}
	oldObj, ok1 := old.(resource.Object)
	newObj, ok2 := obj.(resource.Object)
	if !ok1 || !ok2 {
		logging.FromContext(ctx).Error("Status PrepareForUpdate called with non-resource.Object object")
		return
	}
	newObj.SetAnnotations(oldObj.GetAnnotations())
	newObj.SetLabels(oldObj.GetLabels())
	newObj.SetFinalizers(oldObj.GetFinalizers())
	newObj.SetOwnerReferences(oldObj.GetOwnerReferences())
	// TODO: we shouldn't have to do this, right? It's not being done in OSS grafana, but we lose the spec otherwise here...
	err := newObj.SetSpec(oldObj.GetSpec())
	if err != nil {
		logging.FromContext(ctx).Error("Status PrepareForUpdate set spec error", "error", err)
	}
	// set other subresources
	for _, sr := range g.resetFields {
		if sr == "metadata" || sr == "spec" {
			continue
		}
		oldSubresource, ok := oldObj.GetSubresource(sr)
		if ok {
			err := newObj.SetSubresource(sr, oldSubresource)
			if err != nil {
				logging.FromContext(ctx).Error(fmt.Sprintf("Subresource %s PrepareForUpdate set %s error", g.subresource, sr), "error", err)
			}
		}
	}
}

func (*genericSubresourceStrategy) AllowCreateOnUpdate(_ context.Context) bool {
	return false
}

func (*genericSubresourceStrategy) AllowUnconditionalUpdate(_ context.Context) bool {
	return false
}

// Canonicalize normalizes the object after validation.
func (*genericSubresourceStrategy) Canonicalize(_ runtime.Object) {
}

// ValidateUpdate validates an update of genericStatusStrategy.
func (*genericSubresourceStrategy) ValidateUpdate(_ context.Context, _, _ runtime.Object) field.ErrorList {
	return field.ErrorList{}
}

// WarningsOnUpdate returns warnings for the given update.
func (*genericSubresourceStrategy) WarningsOnUpdate(_ context.Context, _, _ runtime.Object) []string {
	return nil
}
