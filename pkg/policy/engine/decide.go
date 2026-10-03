package engine

import (
	"fmt"

	"github.com/grafana/grafana/pkg/policy/api"
)

// Decision is a violation, or a kept evaluation error, paired with the action a binding takes on it.
type Decision struct {
	Binding string
	Action  api.Action
	Violation
	// Err is set when the decision comes from an evaluation error rather than a failed validation.
	Err error
}

// Decide applies bindings to a result. Only bindings for the result's policy that cover the
// namespace are used. Evaluation errors kept by FailurePolicy Fail are treated as violations,
// so a broken expression cannot let a resource through a Deny binding.
func Decide(res Result, namespace string, bindings []api.Binding) []Decision {
	var out []Decision
	for _, b := range bindings {
		if b.PolicyName != res.Policy {
			continue
		}
		if !bindingCovers(b, namespace) {
			continue
		}
		for _, action := range b.Actions {
			for _, v := range res.Violations {
				out = append(out, Decision{Binding: b.Name, Action: action, Violation: v})
			}
			for _, e := range res.Errors {
				out = append(out, Decision{
					Binding: b.Name,
					Action:  action,
					Violation: Violation{
						Policy:     e.Policy,
						Validation: e.Path,
						Message:    fmt.Sprintf("policy evaluation failed: %v", e.Err),
						Reason:     api.ReasonInvalid,
					},
					Err: e,
				})
			}
		}
	}
	return out
}
