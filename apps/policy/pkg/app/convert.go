package app

import (
	"github.com/grafana/grafana/pkg/policy/api"

	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"
)

// ToPolicy converts a ValidationPolicy resource into the engine's policy type. The resource
// name becomes the policy name, which bindings in the same namespace refer to.
func ToPolicy(p *policyv0alpha1.ValidationPolicy) api.Policy {
	out := api.Policy{
		Name:            p.Name,
		MatchConditions: namedExpressions(p.Spec.MatchConditions),
		Variables:       namedExpressions(p.Spec.Variables),
	}
	for _, m := range p.Spec.Match {
		rm := api.ResourceMatch{Group: m.Group, Versions: m.Versions, Kinds: m.Kinds}
		for _, op := range m.Operations {
			rm.Operations = append(rm.Operations, api.Operation(op))
		}
		out.Match = append(out.Match, rm)
	}
	for _, v := range p.Spec.Validations {
		val := api.Validation{
			Name:              deref(v.Name),
			Expression:        v.Expression,
			Message:           deref(v.Message),
			MessageExpression: deref(v.MessageExpression),
			FieldPath:         deref(v.FieldPath),
		}
		if v.Reason != nil {
			val.Reason = api.Reason(*v.Reason)
		}
		out.Validations = append(out.Validations, val)
	}
	if p.Spec.FailurePolicy != nil {
		out.FailurePolicy = api.FailurePolicy(*p.Spec.FailurePolicy)
	}
	if k := p.Spec.ParamKind; k != nil {
		out.ParamKind = &api.ParamKind{Group: k.Group, Version: k.Version, Kind: k.Kind}
	}
	return out
}

// ToBinding converts a ValidationPolicyBinding resource into the engine's binding type. A
// binding only applies to resources in its own namespace.
func ToBinding(b *policyv0alpha1.ValidationPolicyBinding) api.Binding {
	out := api.Binding{
		Name:       b.Name,
		PolicyName: b.Spec.PolicyName,
		Namespaces: []string{b.Namespace},
	}
	for _, a := range b.Spec.Actions {
		out.Actions = append(out.Actions, api.Action(a))
	}
	if b.Spec.ParamRef != nil {
		out.ParamRef = &api.ParamRef{Name: b.Spec.ParamRef.Name}
	}
	return out
}

func namedExpressions(in []policyv0alpha1.ValidationPolicyNamedExpression) []api.NamedExpression {
	if len(in) == 0 {
		return nil
	}
	out := make([]api.NamedExpression, 0, len(in))
	for _, e := range in {
		out = append(out, api.NamedExpression{Name: e.Name, Expression: e.Expression})
	}
	return out
}

func deref[T any](p *T) T {
	var zero T
	if p == nil {
		return zero
	}
	return *p
}
