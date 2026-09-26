package dashboard

import (
	"fmt"
	"regexp"
	"strings"

	dashv2beta1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v2beta1"
	"github.com/grafana/grafana/pkg/services/folder"
)

var variableNameFormat = regexp.MustCompile(`^\w+$`)

const variableMetadataNameMaxLength = 253

// walkVariableKinds traverses the VariableSpec union in a single pass and
// returns the spec name of whichever kind is populated (empty if none) along
// with the total number of populated kinds. Centralising the walk here keeps
// the name-extraction and kind-counting use cases from drifting when a new
// variable kind is added to the union: the new case only needs a single
// entry in this function.
func walkVariableKinds(spec dashv2beta1.VariableSpec) (name string, count int) {
	if spec.QueryVariableKind != nil {
		name = spec.QueryVariableKind.Spec.Name
		count++
	}
	if spec.TextVariableKind != nil {
		name = spec.TextVariableKind.Spec.Name
		count++
	}
	if spec.ConstantVariableKind != nil {
		name = spec.ConstantVariableKind.Spec.Name
		count++
	}
	if spec.DatasourceVariableKind != nil {
		name = spec.DatasourceVariableKind.Spec.Name
		count++
	}
	if spec.IntervalVariableKind != nil {
		name = spec.IntervalVariableKind.Spec.Name
		count++
	}
	if spec.CustomVariableKind != nil {
		name = spec.CustomVariableKind.Spec.Name
		count++
	}
	if spec.GroupByVariableKind != nil {
		name = spec.GroupByVariableKind.Spec.Name
		count++
	}
	if spec.AdhocVariableKind != nil {
		name = spec.AdhocVariableKind.Spec.Name
		count++
	}
	if spec.SwitchVariableKind != nil {
		name = spec.SwitchVariableKind.Spec.Name
		count++
	}
	return name, count
}

func getVariableName(spec dashv2beta1.VariableSpec) string {
	name, _ := walkVariableKinds(spec)
	return name
}

// deriveVariableMetadataName treats both "" and "general" as the root scope so
// a round-trip GET (which surfaces "general" via convertToObject) → POST stays
// stable instead of producing "specName--general".
func deriveVariableMetadataName(specName, folderUID string) string {
	if folder.IsRootFolderUID(folderUID) {
		return specName
	}
	return specName + "--" + folderUID
}

func validateVariableMetadataName(gotName, specName, folderUID string) error {
	expectedName := deriveVariableMetadataName(specName, folderUID)
	if len(expectedName) > variableMetadataNameMaxLength {
		return fmt.Errorf("derived metadata.name exceeds maximum length (%d)", variableMetadataNameMaxLength)
	}
	if gotName == "" || gotName == expectedName {
		return nil
	}

	if folder.IsRootFolderUID(folderUID) {
		return fmt.Errorf(
			"metadata.name %q does not match the name required for spec.spec.name %q: expected %q (omit metadata.name to let the server set it)",
			gotName,
			specName,
			expectedName,
		)
	}
	return fmt.Errorf(
		"metadata.name %q does not match the name required for spec.spec.name %q in folder %q: expected %q (omit metadata.name to let the server set it)",
		gotName,
		specName,
		folderUID,
		expectedName,
	)
}

func validateVariable(variable *dashv2beta1.Variable) error {
	if variable == nil {
		return fmt.Errorf("variable payload is required")
	}

	name, count := walkVariableKinds(variable.Spec)
	if count != 1 {
		return fmt.Errorf("variable spec must include exactly one variable kind")
	}

	if name == "" {
		return fmt.Errorf("variable name must not be empty")
	}

	if strings.HasPrefix(name, "__") {
		return fmt.Errorf("variable name %q must not start with '__' (reserved for built-in macros)", name)
	}

	if !variableNameFormat.MatchString(name) {
		return fmt.Errorf("variable name %q must contain only letters, digits, and underscores", name)
	}

	return nil
}
