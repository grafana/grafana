package api

import (
	"regexp"
	"slices"

	"k8s.io/apimachinery/pkg/util/validation/field"
)

// variableNamePattern matches names that can be used as `variables.<name>` in CEL.
var variableNamePattern = regexp.MustCompile(`^[a-zA-Z_][a-zA-Z0-9_]*$`)

// Validate checks the structure of the policy. It does not compile expressions; the engine does that.
func (p Policy) Validate() field.ErrorList {
	var errs field.ErrorList
	if p.Name == "" {
		errs = append(errs, field.Required(field.NewPath("name"), ""))
	}

	matchPath := field.NewPath("match")
	if len(p.Match) == 0 {
		errs = append(errs, field.Required(matchPath, "at least one resource match is required"))
	}
	for i, m := range p.Match {
		errs = append(errs, m.validate(matchPath.Index(i))...)
	}

	errs = append(errs, validateNamedExpressions(p.MatchConditions, field.NewPath("matchConditions"), false)...)
	errs = append(errs, validateNamedExpressions(p.Variables, field.NewPath("variables"), true)...)

	validationsPath := field.NewPath("validations")
	if len(p.Validations) == 0 {
		errs = append(errs, field.Required(validationsPath, "at least one validation is required"))
	}
	names := map[string]struct{}{}
	for i, v := range p.Validations {
		path := validationsPath.Index(i)
		if v.Expression == "" {
			errs = append(errs, field.Required(path.Child("expression"), ""))
		}
		if v.Name != "" {
			if _, ok := names[v.Name]; ok {
				errs = append(errs, field.Duplicate(path.Child("name"), v.Name))
			}
			names[v.Name] = struct{}{}
		}
		if v.Reason != "" && !slices.Contains([]Reason{ReasonInvalid, ReasonForbidden, ReasonUnauthorized}, v.Reason) {
			errs = append(errs, field.NotSupported(path.Child("reason"), v.Reason, []Reason{ReasonInvalid, ReasonForbidden, ReasonUnauthorized}))
		}
	}

	if p.FailurePolicy != "" && p.FailurePolicy != FailurePolicyFail && p.FailurePolicy != FailurePolicyIgnore {
		errs = append(errs, field.NotSupported(field.NewPath("failurePolicy"), p.FailurePolicy, []FailurePolicy{FailurePolicyFail, FailurePolicyIgnore}))
	}

	if p.ParamKind != nil {
		path := field.NewPath("paramKind")
		if p.ParamKind.Group == "" {
			errs = append(errs, field.Required(path.Child("group"), ""))
		}
		if p.ParamKind.Version == "" {
			errs = append(errs, field.Required(path.Child("version"), ""))
		}
		if p.ParamKind.Kind == "" {
			errs = append(errs, field.Required(path.Child("kind"), ""))
		}
	}
	return errs
}

func (m ResourceMatch) validate(path *field.Path) field.ErrorList {
	var errs field.ErrorList
	if m.Group == "" {
		errs = append(errs, field.Required(path.Child("group"), ""))
	}
	errs = append(errs, validateNonEmptyUnique(m.Versions, path.Child("versions"))...)
	errs = append(errs, validateNonEmptyUnique(m.Kinds, path.Child("kinds"))...)
	supported := []Operation{OperationCreate, OperationUpdate, OperationDelete}
	for i, op := range m.Operations {
		if !slices.Contains(supported, op) {
			errs = append(errs, field.NotSupported(path.Child("operations").Index(i), op, supported))
		}
	}
	return errs
}

func validateNonEmptyUnique(values []string, path *field.Path) field.ErrorList {
	var errs field.ErrorList
	if len(values) == 0 {
		errs = append(errs, field.Required(path, ""))
	}
	seen := map[string]struct{}{}
	for i, v := range values {
		if v == "" {
			errs = append(errs, field.Required(path.Index(i), ""))
			continue
		}
		if _, ok := seen[v]; ok {
			errs = append(errs, field.Duplicate(path.Index(i), v))
		}
		seen[v] = struct{}{}
	}
	return errs
}

func validateNamedExpressions(exprs []NamedExpression, path *field.Path, isVariable bool) field.ErrorList {
	var errs field.ErrorList
	seen := map[string]struct{}{}
	for i, e := range exprs {
		p := path.Index(i)
		switch {
		case e.Name == "":
			errs = append(errs, field.Required(p.Child("name"), ""))
		case isVariable && !variableNamePattern.MatchString(e.Name):
			errs = append(errs, field.Invalid(p.Child("name"), e.Name, "must be a valid CEL identifier"))
		}
		if _, ok := seen[e.Name]; ok && e.Name != "" {
			errs = append(errs, field.Duplicate(p.Child("name"), e.Name))
		}
		seen[e.Name] = struct{}{}
		if e.Expression == "" {
			errs = append(errs, field.Required(p.Child("expression"), ""))
		}
	}
	return errs
}

// Validate checks the structure of the binding.
func (b Binding) Validate() field.ErrorList {
	var errs field.ErrorList
	if b.Name == "" {
		errs = append(errs, field.Required(field.NewPath("name"), ""))
	}
	if b.PolicyName == "" {
		errs = append(errs, field.Required(field.NewPath("policyName"), ""))
	}

	actionsPath := field.NewPath("actions")
	if len(b.Actions) == 0 {
		errs = append(errs, field.Required(actionsPath, "at least one action is required"))
	}
	supported := []Action{ActionDeny, ActionWarn}
	seen := map[Action]struct{}{}
	for i, a := range b.Actions {
		if !slices.Contains(supported, a) {
			errs = append(errs, field.NotSupported(actionsPath.Index(i), a, supported))
			continue
		}
		if _, ok := seen[a]; ok {
			errs = append(errs, field.Duplicate(actionsPath.Index(i), a))
		}
		seen[a] = struct{}{}
	}
	_, deny := seen[ActionDeny]
	_, warn := seen[ActionWarn]
	if deny && warn {
		// A denied request never reaches the caller as a success, so the warning would be lost.
		errs = append(errs, field.Invalid(actionsPath, b.Actions, "Deny and Warn cannot be combined"))
	}
	if b.ParamRef != nil && b.ParamRef.Name == "" {
		errs = append(errs, field.Required(field.NewPath("paramRef", "name"), ""))
	}
	return errs
}
