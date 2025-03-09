package v1alpha1

import (
	"fmt"

	"k8s.io/apimachinery/pkg/runtime"
)

func addConversionFuncs(scheme *runtime.Scheme) error {
	return scheme.AddFieldLabelConversionFunc(
		schemeGroupVersion.WithKind("Dashboard"),
		func(label, value string) (string, string, error) {
			switch label {
			case "metadata.name", "metadata.generation", "metadata.namespace":
				return label, value, nil
			default:
				return "", "", fmt.Errorf("field label not supported: %s", label)
			}
		},
	)
}
