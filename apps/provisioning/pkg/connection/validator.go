package connection

import (
	"context"
	"fmt"

	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

//go:generate mockery --name GithubFactory --structname MockGithubFactory --inpackage --filename factory_mock.go --with-expecter
type GithubFactory interface {
	New(ctx context.Context, ghToken common.RawSecureValue) github.Client
}

type Validator struct {
	githubClientFactory GithubFactory
}

func NewValidator(githubClientFactory GithubFactory) Validator {
	return Validator{githubClientFactory: githubClientFactory}
}

func (v *Validator) ValidateConnection(ctx context.Context, connection *provisioning.Connection) error {
	list := field.ErrorList{}

	if connection.Spec.Type == "" {
		list = append(list, field.Required(field.NewPath("spec", "type"), "type must be specified"))
	}

	switch connection.Spec.Type {
	case provisioning.GithubConnectionType:
		list = append(list, v.validateGithubConnection(ctx, connection)...)
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

func (v *Validator) validateGithubConnection(ctx context.Context, connection *provisioning.Connection) field.ErrorList {
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
	if connection.Secure.Token.IsZero() {
		list = append(list, field.Required(field.NewPath("secure", "token"), "token must be specified for GitHub connection"))
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

	// In case we have any error above, we don't go forward with the validation, and return the errors.
	if len(list) > 0 {
		return list
	}

	if err := v.validateAppAndInstallation(
		ctx,
		connection.Spec.GitHub.AppID,
		connection.Spec.GitHub.InstallationID,
		connection.Secure.Token.Create,
	); err != nil {
		list = append(list, err)
	}

	return list
}

// validateAppAndInstallation validates the appID and installationID against the given github token.
func (v *Validator) validateAppAndInstallation(
	ctx context.Context,
	appID string,
	installationID string,
	token common.RawSecureValue,
) *field.Error {
	ghClient := v.githubClientFactory.New(ctx, "")

	app, err := ghClient.GetApp(ctx, string(token))
	if err != nil {
		// TODO(ferruvich): what to do when service is unavailable? Should we retry?
		return field.Invalid(field.NewPath("spec", "token"), "[REDACTED]", "invalid token")
	}

	if fmt.Sprintf("%d", app.ID) != appID {
		//TODO(ferruvich): should we better explain why the app ID is invalid? Or should we
		return field.Invalid(field.NewPath("spec", "appID"), appID, "invalid app ID")
	}

	_, err = ghClient.GetAppInstallation(ctx, string(token), installationID)
	if err != nil {
		// TODO(ferruvich): what to do when service is unavailable? Should we retry?
		return field.Invalid(field.NewPath("spec", "token"), "[REDACTED]", "invalid token")
	}

	return nil
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
