package app

import (
	"fmt"

	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"

	rulepolicyv0alpha1 "github.com/grafana/grafana/apps/alerting/rulepolicy/pkg/apis/rulepolicy/v0alpha1"
)

const (
	// ManagedLabel marks the policies and bindings written by this app. Its value is the name of
	// the RulePolicy they enforce.
	ManagedLabel = "rulepolicy.alerting.grafana.app/rule-policy"

	namePrefix   = "rulepolicy-"
	rulesGroup   = "rules.alerting.grafana.app"
	rulesVersion = "v0alpha1"
)

// managedName is the name of the validation policy and binding that enforce a RulePolicy.
func managedName(rulePolicy string) string {
	return namePrefix + rulePolicy
}

// policySpec is the same for every RulePolicy: which labels and annotations are required comes
// from the RulePolicy itself, which the binding uses as its parameter object.
func policySpec() policyv0alpha1.ValidationPolicySpec {
	fail := policyv0alpha1.ValidationPolicyFailurePolicyFail
	return policyv0alpha1.ValidationPolicySpec{
		Match: []policyv0alpha1.ValidationPolicyResourceMatch{{
			Group:      rulesGroup,
			Versions:   []string{rulesVersion},
			Kinds:      []string{"AlertRule"},
			Operations: []policyv0alpha1.ValidationPolicyOperation{policyv0alpha1.ValidationPolicyOperationCREATE, policyv0alpha1.ValidationPolicyOperationUPDATE},
		}},
		ParamKind: &policyv0alpha1.ValidationPolicyParamKind{
			Group:   rulepolicyv0alpha1.APIGroup,
			Version: rulepolicyv0alpha1.APIVersion,
			Kind:    rulepolicyv0alpha1.RulePolicyKind().Kind(),
		},
		Variables: []policyv0alpha1.ValidationPolicyNamedExpression{
			{Name: "requiredLabelKeys", Expression: keys("requiredLabels")},
			{Name: "requiredAnnotationKeys", Expression: keys("requiredAnnotations")},
			{Name: "forbiddenLabelKeys", Expression: keys("forbiddenLabels")},
			{Name: "forbiddenAnnotationKeys", Expression: keys("forbiddenAnnotations")},
			{Name: "missingLabels", Expression: missing("requiredLabelKeys", "labels")},
			{Name: "missingAnnotations", Expression: missing("requiredAnnotationKeys", "annotations")},
			{Name: "presentLabels", Expression: present("forbiddenLabelKeys", "labels")},
			{Name: "presentAnnotations", Expression: present("forbiddenAnnotationKeys", "annotations")},
		},
		Validations: []policyv0alpha1.ValidationPolicyValidation{
			ruleValidation("required-labels", "labels", "missingLabels", "labels missing or empty"),
			ruleValidation("required-annotations", "annotations", "missingAnnotations", "annotations missing or empty"),
			ruleValidation("forbidden-labels", "labels", "presentLabels", "forbidden labels present"),
			ruleValidation("forbidden-annotations", "annotations", "presentAnnotations", "forbidden annotations present"),
		},
		// An expression that cannot be evaluated must not let a rule through a Deny RulePolicy.
		FailurePolicy: &fail,
	}
}

// keys selects the trimmed, non-blank keys listed in a field of the RulePolicy.
func keys(field string) string {
	return fmt.Sprintf(
		"has(params.spec.%[1]s) ? params.spec.%[1]s.map(k, k.trim()).filter(k, k != '') : []",
		field,
	)
}

// missing selects the keys that are absent from the rule, or present with a blank value.
func missing(keysVar, ruleField string) string {
	return fmt.Sprintf(
		"variables.%[1]s.filter(k, !has(object.spec.%[2]s) || !(k in object.spec.%[2]s) || object.spec.%[2]s[k].trim() == '')",
		keysVar, ruleField,
	)
}

// present selects the keys that are set on the rule, whatever their value.
func present(keysVar, ruleField string) string {
	return fmt.Sprintf(
		"variables.%[1]s.filter(k, has(object.spec.%[2]s) && k in object.spec.%[2]s)",
		keysVar, ruleField,
	)
}

// ruleValidation fails when the list in offendingVar is not empty, naming its keys.
func ruleValidation(name, ruleField, offendingVar, problem string) policyv0alpha1.ValidationPolicyValidation {
	msg := fmt.Sprintf("'%s: ' + variables.%s.join(', ')", problem, offendingVar)
	path := "spec." + ruleField
	return policyv0alpha1.ValidationPolicyValidation{
		Name:              &name,
		Expression:        fmt.Sprintf("size(variables.%s) == 0", offendingVar),
		MessageExpression: &msg,
		FieldPath:         &path,
	}
}

func bindingSpec(p *rulepolicyv0alpha1.RulePolicy) policyv0alpha1.ValidationPolicyBindingSpec {
	return policyv0alpha1.ValidationPolicyBindingSpec{
		PolicyName: managedName(p.Name),
		Actions:    []policyv0alpha1.ValidationPolicyBindingAction{policyv0alpha1.ValidationPolicyBindingAction(p.Spec.Enforcement)},
		ParamRef:   &policyv0alpha1.ValidationPolicyBindingParamRef{Name: p.Name},
	}
}
