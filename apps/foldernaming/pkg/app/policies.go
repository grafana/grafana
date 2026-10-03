package app

import (
	policyv0alpha1 "github.com/grafana/grafana/apps/policy/pkg/apis/policy/v0alpha1"

	foldernamingv0alpha1 "github.com/grafana/grafana/apps/foldernaming/pkg/apis/foldernaming/v0alpha1"
)

const (
	// ManagedLabel marks the policies and bindings written by this app. Its value is the name of
	// the FolderNamingPolicy they enforce.
	ManagedLabel = "foldernaming.grafana.app/folder-naming-policy"

	namePrefix  = "foldernaming-"
	folderGroup = "folder.grafana.app"
)

// folderVersions are the served folder versions; the policy is type-checked against each.
var folderVersions = []string{"v1", "v1beta1"}

// managedName is the name of the validation policy and binding that enforce a FolderNamingPolicy.
func managedName(policy string) string {
	return namePrefix + policy
}

// policySpec is the same for every FolderNamingPolicy: the convention comes from the
// FolderNamingPolicy itself, which the binding uses as its parameter object.
func policySpec() policyv0alpha1.ValidationPolicySpec {
	fail := policyv0alpha1.ValidationPolicyFailurePolicyFail
	name := "title"
	path := "spec.title"
	msg := `'folder title "' + object.spec.title + '" does not follow the naming convention' + ` +
		`(has(params.spec.description) && params.spec.description != '' ? ': ' + params.spec.description : ' ' + params.spec.titlePattern)`
	return policyv0alpha1.ValidationPolicySpec{
		Match: []policyv0alpha1.ValidationPolicyResourceMatch{{
			Group:      folderGroup,
			Versions:   folderVersions,
			Kinds:      []string{"Folder"},
			Operations: []policyv0alpha1.ValidationPolicyOperation{policyv0alpha1.ValidationPolicyOperationCREATE, policyv0alpha1.ValidationPolicyOperationUPDATE},
		}},
		ParamKind: &policyv0alpha1.ValidationPolicyParamKind{
			Group:   foldernamingv0alpha1.APIGroup,
			Version: foldernamingv0alpha1.APIVersion,
			Kind:    foldernamingv0alpha1.FolderNamingPolicyKind().Kind(),
		},
		MatchConditions: []policyv0alpha1.ValidationPolicyNamedExpression{{
			// Existing folders that predate the convention can still be moved and updated; only
			// new titles must follow it.
			Name:       "title-set",
			Expression: "oldObject == null || oldObject.spec.title != object.spec.title",
		}},
		Validations: []policyv0alpha1.ValidationPolicyValidation{{
			Name: &name,
			// Anchored so the whole title has to follow the convention, not just part of it.
			Expression:        "object.spec.title.matches('^(?:' + params.spec.titlePattern + ')$')",
			MessageExpression: &msg,
			FieldPath:         &path,
		}},
		// A title that cannot be checked must not get past a Deny policy.
		FailurePolicy: &fail,
	}
}

func bindingSpec(p *foldernamingv0alpha1.FolderNamingPolicy) policyv0alpha1.ValidationPolicyBindingSpec {
	return policyv0alpha1.ValidationPolicyBindingSpec{
		PolicyName: managedName(p.Name),
		Actions:    []policyv0alpha1.ValidationPolicyBindingAction{policyv0alpha1.ValidationPolicyBindingAction(p.Spec.Enforcement)},
		ParamRef:   &policyv0alpha1.ValidationPolicyBindingParamRef{Name: p.Name},
	}
}
