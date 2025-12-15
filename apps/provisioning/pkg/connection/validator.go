package connection

import (
	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func ValidateConnection(connection *provisioning.Connection) error {
	list := field.ErrorList{}

	if connection.Spec.Type == "" {
		list = append(list, field.Required(field.NewPath("spec", "type"), "spec.type must be specified"))
	}

	switch connection.Spec.Type {
	case provisioning.GithubConnectionType:
		if connection.Spec.GitHub == nil {
			list = append(
				list,
				field.Required(field.NewPath("spec", "github"), "spec.github must be specified"),
			)
		}
	case provisioning.BitbucketConnectionType:
		if connection.Spec.Bitbucket == nil {
			list = append(
				list,
				field.Required(field.NewPath("spec", "bitbucket"), "spec.bitbucket must be specified"),
			)
		}
	case provisioning.GitlabConnectionType:
		if connection.Spec.Gitlab == nil {
			list = append(
				list,
				field.Required(field.NewPath("spec", "gitlab"), "spec.gitlab must be specified"),
			)
		}
	}

	return toError(connection.GetName(), list)
}

// toError converts a field.ErrorList to an error, returning nil if the list is empty
func toError(name string, list field.ErrorList) error {
	if len(list) == 0 {
		return nil
	}
	return apierrors.NewInvalid(
		provisioning.ConnectionResourceInfo.GroupVersionKind().GroupKind(),
		name,
		list,
	)
}
