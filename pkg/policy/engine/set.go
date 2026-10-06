package engine

import (
	"context"
	"errors"
	"fmt"
	"slices"

	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/policy/api"
)

// ErrParamsNotFound is returned by a ParamSource when the parameter object does not exist.
// The binding then does not apply.
var ErrParamsNotFound = errors.New("parameter object not found")

// ParamSource looks up the parameter object of a binding. It is the only part of evaluation
// that depends on the execution environment: admission reads from the API, static evaluation
// from files or the API.
type ParamSource interface {
	// GetParams returns the parameter object in unstructured form, or ErrParamsNotFound.
	GetParams(ctx context.Context, gvk schema.GroupVersionKind, namespace, name string) (map[string]any, error)
}

// Set is an immutable collection of compiled policies and their bindings, indexed by the kinds
// and versions they apply to. It is the single entry point used by execution environments.
// To change policies, build a new Set and swap it in.
type Set struct {
	byGVK    map[schema.GroupVersionKind][]*CompiledPolicy
	bindings map[string][]api.Binding
	params   ParamSource
}

// Evaluation is the outcome of evaluating every applicable policy in a Set against one input.
type Evaluation struct {
	Results   []Result
	Decisions []Decision
}

// NewSet validates bindings and indexes the policies. Policies without bindings are still
// evaluated, which lets static evaluation report on policies that are not enforced yet, unless
// they need parameters, which only bindings provide. params may be nil when no policy has a ParamKind.
func NewSet(policies []*CompiledPolicy, bindings []api.Binding, params ParamSource) (*Set, error) {
	s := &Set{
		byGVK:    map[schema.GroupVersionKind][]*CompiledPolicy{},
		bindings: map[string][]api.Binding{},
		params:   params,
	}
	var errs []error
	byName := map[string]*CompiledPolicy{}
	for _, p := range policies {
		name := p.Policy().Name
		if _, ok := byName[name]; ok {
			errs = append(errs, fmt.Errorf("duplicate policy %q", name))
			continue
		}
		byName[name] = p
		if _, hasParams := p.ParamGVK(); hasParams && params == nil {
			errs = append(errs, fmt.Errorf("policy %q has a param kind but no param source was provided", name))
		}
		for _, gvk := range p.GVKs() {
			s.byGVK[gvk] = append(s.byGVK[gvk], p)
		}
	}

	bindingNames := map[string]struct{}{}
	for _, b := range bindings {
		if verrs := b.Validate(); len(verrs) > 0 {
			errs = append(errs, fmt.Errorf("binding %q: %w", b.Name, verrs.ToAggregate()))
			continue
		}
		if _, ok := bindingNames[b.Name]; ok {
			errs = append(errs, fmt.Errorf("duplicate binding %q", b.Name))
			continue
		}
		bindingNames[b.Name] = struct{}{}
		p, ok := byName[b.PolicyName]
		if !ok {
			errs = append(errs, fmt.Errorf("binding %q references unknown policy %q", b.Name, b.PolicyName))
			continue
		}
		if _, hasParams := p.ParamGVK(); hasParams && b.ParamRef == nil {
			errs = append(errs, fmt.Errorf("binding %q must set paramRef because policy %q has a param kind", b.Name, b.PolicyName))
			continue
		}
		s.bindings[b.PolicyName] = append(s.bindings[b.PolicyName], b)
	}
	if len(errs) > 0 {
		return nil, errors.Join(errs...)
	}
	return s, nil
}

// Matches reports whether any policy applies to the kind and version. Callers can use it to
// avoid converting objects that no policy will inspect.
func (s *Set) Matches(gvk schema.GroupVersionKind) bool {
	return len(s.byGVK[gvk]) > 0
}

// Bindings returns the bindings of a policy that cover a namespace.
func (s *Set) Bindings(policy, namespace string) []api.Binding {
	var out []api.Binding
	for _, b := range s.bindings[policy] {
		if bindingCovers(b, namespace) {
			out = append(out, b)
		}
	}
	return out
}

// EvaluateAll evaluates every policy for the input's kind and version and applies their bindings.
// Only applicable results, and results with skipped rules or ignored errors, are returned.
func (s *Set) EvaluateAll(ctx context.Context, in Input) Evaluation {
	var out Evaluation
	add := func(res Result, bindings []api.Binding) {
		if !res.Applicable && len(res.Skipped) == 0 && len(res.Ignored) == 0 {
			return
		}
		out.Results = append(out.Results, res)
		out.Decisions = append(out.Decisions, Decide(res, in.Namespace, bindings)...)
	}

	for _, p := range s.byGVK[in.GVK] {
		bindings := s.bindings[p.Policy().Name]
		paramGVK, hasParams := p.ParamGVK()
		if !hasParams {
			add(p.Evaluate(ctx, in), bindings)
			continue
		}
		for _, b := range bindings {
			if !bindingCovers(b, in.Namespace) {
				continue
			}
			params, err := s.params.GetParams(ctx, paramGVK, in.Namespace, b.ParamRef.Name)
			switch {
			case errors.Is(err, ErrParamsNotFound):
				continue
			case err != nil:
				res := Result{Policy: p.Policy().Name, Binding: b.Name}
				evalErr := EvalError{Policy: p.Policy().Name, Path: "paramRef", Err: err}
				if p.Policy().EffectiveFailurePolicy() == api.FailurePolicyFail {
					res.Applicable = true
					res.Errors = []EvalError{evalErr}
				} else {
					res.Ignored = []EvalError{evalErr}
				}
				add(res, []api.Binding{b})
				continue
			}
			bound := in
			bound.Params = params
			res := p.Evaluate(ctx, bound)
			res.Binding = b.Name
			add(res, []api.Binding{b})
		}
	}
	return out
}

func bindingCovers(b api.Binding, namespace string) bool {
	return len(b.Namespaces) == 0 || slices.Contains(b.Namespaces, namespace)
}
