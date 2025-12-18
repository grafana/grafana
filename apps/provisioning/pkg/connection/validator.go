package connection

import (
	"encoding/base64"
	"fmt"
	"strconv"

	"github.com/golang-jwt/jwt/v4"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/util/validation/field"
)

func ValidateConnection(connection *provisioning.Connection) error {
	list := field.ErrorList{}

	if connection.Spec.Type == "" {
		list = append(list, field.Required(field.NewPath("spec", "type"), "type must be specified"))
	}

	switch connection.Spec.Type {
	case provisioning.GithubConnectionType:
		list = append(list, validateGithubConnection(connection)...)
	case provisioning.BitbucketConnectionType:
		list = append(list, validateBitbucketConnection(connection)...)
	case provisioning.GitlabConnectionType:
		list = append(list, validateGitlabConnection(connection)...)
	default:
		list = append(
			list, field.NotSupported(
				field.NewPath("spec", "type"),
				connection.Spec.Type,
				[]provisioning.ConnectionType{
					provisioning.GithubConnectionType,
					provisioning.BitbucketConnectionType,
					provisioning.GitlabConnectionType,
				}),
		)
	}

	return toError(connection.GetName(), list)
}

func validateGithubConnection(connection *provisioning.Connection) field.ErrorList {
	list := field.ErrorList{}

	if connection.Spec.GitHub == nil {
		list = append(
			list, field.Required(field.NewPath("spec", "github"), "github info must be specified for GitHub connection"),
		)
		return list
	}

	if connection.Secure.PrivateKey.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "privateKey"), "privateKey must be specified for GitHub connection"))
	}
	if !connection.Secure.ClientSecret.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "clientSecret"), "clientSecret is forbidden in GitHub connection"))
	}

	// Validate GitHub configuration fields
	if connection.Spec.GitHub.AppID == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "appID"), "appID must be specified for GitHub connection"))
	}

	if connection.Spec.GitHub.InstallationID == "" {
		list = append(list, field.Required(field.NewPath("spec", "github", "installationID"), "installationID must be specified for GitHub connection"))
	}

	// If we have a private key being created, validate it can generate a JWT
	if !connection.Secure.PrivateKey.Create.IsZero() && connection.Spec.GitHub.AppID != "" {
		if err := validatePrivateKeyAndAppID(connection.Spec.GitHub.AppID, connection.Secure.PrivateKey.Create); err != nil {
			list = append(list, field.Invalid(field.NewPath("secure", "privateKey"), "[REDACTED]", err.Error()))
		}
	}

	return list
}

func validateBitbucketConnection(connection *provisioning.Connection) field.ErrorList {
	list := field.ErrorList{}

	if connection.Spec.Bitbucket == nil {
		list = append(
			list, field.Required(field.NewPath("spec", "bitbucket"), "bitbucket info must be specified in Bitbucket connection"),
		)
	}
	if connection.Secure.ClientSecret.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "clientSecret"), "clientSecret must be specified for Bitbucket connection"))
	}
	if !connection.Secure.PrivateKey.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "privateKey"), "privateKey is forbidden in Bitbucket connection"))
	}

	return list
}

func validateGitlabConnection(connection *provisioning.Connection) field.ErrorList {
	list := field.ErrorList{}

	if connection.Spec.Gitlab == nil {
		list = append(
			list, field.Required(field.NewPath("spec", "gitlab"), "gitlab info must be specified in Gitlab connection"),
		)
	}
	if connection.Secure.ClientSecret.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "clientSecret"), "clientSecret must be specified for Gitlab connection"))
	}
	if !connection.Secure.PrivateKey.IsZero() {
		list = append(list, field.Forbidden(field.NewPath("secure", "privateKey"), "privateKey is forbidden in Gitlab connection"))
	}

	return list
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

// validatePrivateKeyAndAppID validates the private key and app ID by attempting to parse them
func validatePrivateKeyAndAppID(appID string, privateKeyBase64 common.RawSecureValue) error {
	// Validate appID is a valid number
	if _, err := strconv.ParseInt(appID, 10, 64); err != nil {
		return fmt.Errorf("invalid app ID format: must be a number")
	}

	// Decode base64-encoded private key
	privateKeyPEM, err := base64.StdEncoding.DecodeString(string(privateKeyBase64))
	if err != nil {
		return fmt.Errorf("failed to decode base64 private key: must be a valid base64-encoded string")
	}

	// Try to parse the private key
	if _, err := jwt.ParseRSAPrivateKeyFromPEM(privateKeyPEM); err != nil {
		return fmt.Errorf("invalid RSA private key: must be a valid PEM-encoded RSA private key")
	}

	return nil
}
