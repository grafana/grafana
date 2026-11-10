package source

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

type extra struct {
	decrypter     connection.Decrypter
	allowInsecure bool
	httpClient    *http.Client
}

type Option func(*extra)

// WithURLValidator checks the address of every connection to the token endpoint at dial
// time, so the client secret cannot be sent to an internal service.
func WithURLValidator(v *repository.URLValidator) Option {
	return func(e *extra) {
		transport := http.DefaultTransport.(*http.Transport).Clone()
		transport.DialContext = v.DialContext(&net.Dialer{Timeout: 10 * time.Second})
		e.httpClient = &http.Client{
			Transport: transport,
			Timeout:   30 * time.Second,
			// The secret is only ever sent to the configured endpoint.
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		}
	}
}

// Extra registers the source connection type.
func Extra(decrypter connection.Decrypter, allowInsecure bool, opts ...Option) connection.Extra {
	e := &extra{decrypter: decrypter, allowInsecure: allowInsecure}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

func (e *extra) Type() provisioning.ConnectionType {
	return provisioning.SourceConnectionType
}

func (e *extra) Build(ctx context.Context, conn *provisioning.Connection) (connection.Connection, error) {
	if conn == nil || conn.Spec.Source == nil || conn.Spec.OAuth == nil {
		return nil, fmt.Errorf("source and oauth configuration are required")
	}

	secure := e.decrypter(conn)
	clientSecret, err := secure.ClientSecret(ctx)
	if err != nil {
		return nil, fmt.Errorf("decrypt client secret: %w", err)
	}
	token, err := secure.Token(ctx)
	if err != nil {
		return nil, fmt.Errorf("decrypt token: %w", err)
	}

	return &sourceConnection{
		cfg:          *conn.Spec.Source,
		clientID:     conn.Spec.OAuth.ClientID,
		clientSecret: clientSecret,
		token:        token,
		httpClient:   e.httpClient,
	}, nil
}

func (e *extra) Mutate(context.Context, runtime.Object) error {
	return nil
}

func (e *extra) Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	conn, ok := obj.(*provisioning.Connection)
	if !ok || conn.Spec.Type != provisioning.SourceConnectionType {
		return nil
	}

	var errs field.ErrorList
	if conn.Spec.Source == nil {
		errs = append(errs, field.Required(field.NewPath("spec", "source"), "source info must be specified for source connections"))
	} else {
		errs = append(errs, e.validateTokenURL(conn.Spec.Source.TokenURL)...)
	}

	if conn.Spec.OAuth == nil || conn.Spec.OAuth.ClientID == "" {
		errs = append(errs, field.Required(field.NewPath("spec", "oauth", "clientID"), "clientID must be specified for source connections"))
	}
	if conn.Secure.ClientSecret.IsZero() || conn.Secure.ClientSecret.Remove {
		errs = append(errs, field.Required(field.NewPath("secure", "clientSecret"), "clientSecret must be specified for source connections"))
	}
	if !conn.Secure.PrivateKey.IsZero() {
		errs = append(errs, field.Forbidden(field.NewPath("secure", "privateKey"), "privateKey is forbidden in source connections"))
	}
	return errs
}

func (e *extra) validateTokenURL(raw string) field.ErrorList {
	path := field.NewPath("spec", "source", "tokenURL")
	if raw == "" {
		return field.ErrorList{field.Required(path, "a token endpoint URL is required")}
	}
	u, err := url.Parse(raw)
	switch {
	case err != nil || u.Host == "":
		return field.ErrorList{field.Invalid(path, raw, "must be an absolute URL with a host")}
	case u.Scheme != "https" && (!e.allowInsecure || u.Scheme != "http"):
		return field.ErrorList{field.Invalid(path, raw, "the token endpoint must use https:// to avoid sending credentials in cleartext")}
	case u.User != nil || u.Fragment != "":
		return field.ErrorList{field.Invalid(path, raw, "must not contain credentials or a fragment")}
	}
	return nil
}
