package gitoauth

import (
	"context"
	"errors"
	"net/url"

	"golang.org/x/oauth2"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/oauth"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/git"
)

func Extra(decrypter connection.Decrypter, allowInsecure bool) connection.Extra {
	return oauth.NewExtra(
		decrypter,
		provisioning.GitOAuthConnectionType,
		provisioning.GitRepositoryType,
		newProvider,
		func(spec provisioning.ConnectionSpec) field.ErrorList {
			return validateSpec(spec, allowInsecure)
		},
	)
}

func newProvider(_ context.Context, spec provisioning.ConnectionSpec, _ string) (oauth.Provider, error) {
	if spec.GitOAuth == nil {
		return nil, errors.New("gitOAuth configuration is required")
	}
	return &provider{endpoint: oauth2.Endpoint{
		AuthURL:  spec.GitOAuth.AuthURL,
		TokenURL: spec.GitOAuth.TokenURL,
	}}, nil
}

func validateSpec(spec provisioning.ConnectionSpec, allowInsecure bool) field.ErrorList {
	path := field.NewPath("spec", "gitOAuth")
	if spec.GitOAuth == nil {
		return field.ErrorList{field.Required(path, "gitOAuth info must be specified for git OAuth connections")}
	}

	var errs field.ErrorList
	if err := validateEndpoint(path.Child("authURL"), spec.GitOAuth.AuthURL, allowInsecure); err != nil {
		errs = append(errs, err)
	}
	if err := validateEndpoint(path.Child("tokenURL"), spec.GitOAuth.TokenURL, allowInsecure); err != nil {
		errs = append(errs, err)
	}
	return errs
}

func validateEndpoint(path *field.Path, value string, allowInsecure bool) *field.Error {
	if value == "" {
		return field.Required(path, "an OAuth endpoint URL is required")
	}
	if err := git.ValidateHTTPScheme(path, value); err != nil {
		return err
	}
	if u, err := url.Parse(value); err != nil || u.Host == "" {
		return field.Invalid(path, value, "must be an absolute URL with a host")
	}
	if !allowInsecure && git.IsInsecureURLWithToken(value, true) {
		return field.Invalid(path, value, "http:// is not allowed; use https:// to avoid sending credentials in cleartext")
	}
	return nil
}
