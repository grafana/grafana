package source

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"sync"
	"time"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
)

type extra struct {
	decrypter repository.Decrypter
	// allowInsecure permits http:// URLs (cleartext); local/dev only.
	allowInsecure bool
	metrics       *repository.OperationMetrics
	urlValidator  *repository.URLValidator
	exchanger     TokenExchanger

	mu      sync.Mutex
	sources map[string]*sourceClient
}

// sourceClient is what survives between short-lived repository builds: the caches
// and the HTTP client, so connections to the source are reused.
type sourceClient struct {
	state *State
	http  *http.Client
}

type Option func(*extra)

// WithURLValidator checks the address of every connection against the validator,
// at dial time, so a source cannot be pointed at an internal service.
func WithURLValidator(v *repository.URLValidator) Option {
	return func(e *extra) { e.urlValidator = v }
}

// WithTokenExchanger enables the tokenExchange auth mode, which needs a token exchange service.
func WithTokenExchanger(x TokenExchanger) Option {
	return func(e *extra) { e.exchanger = x }
}

// Extra registers the source repository type.
func Extra(decrypter repository.Decrypter, allowInsecure bool, metrics *repository.OperationMetrics, opts ...Option) repository.Extra {
	e := &extra{
		decrypter:     decrypter,
		allowInsecure: allowInsecure,
		metrics:       metrics,
		sources:       map[string]*sourceClient{},
	}
	for _, opt := range opts {
		opt(e)
	}
	return e
}

func (e *extra) Type() provisioning.RepositoryType {
	return provisioning.SourceRepositoryType
}

func (e *extra) Build(ctx context.Context, r *provisioning.Repository) (repository.Repository, error) {
	cfg := r.Spec.Source
	if cfg == nil {
		return nil, fmt.Errorf("source configuration is required")
	}

	auth, err := e.authenticator(ctx, r)
	if err != nil {
		return nil, err
	}
	sc, err := e.client(cfg)
	if err != nil {
		return nil, err
	}

	client := NewClient(cfg.URL, ClientOptions{Auth: auth, State: sc.state, HTTPClient: sc.http})
	desc, err := client.Descriptor(ctx, false)
	if err != nil {
		return nil, fmt.Errorf("read source descriptor: %w", err)
	}

	webhookSecret, err := e.decrypter(r).WebhookSecret(ctx)
	if err != nil {
		return nil, fmt.Errorf("unable to decrypt webhook secret: %w", err)
	}
	return NewRepository(r, client, desc, e.metrics, webhookSecret), nil
}

func (e *extra) authenticator(ctx context.Context, r *provisioning.Repository) (Authenticator, error) {
	switch authType(r.Spec.Source) {
	case provisioning.SourceAuthTokenExchange:
		if e.exchanger == nil {
			return nil, fmt.Errorf("token exchange is not available in this deployment")
		}
		return exchangeAuth{exchanger: e.exchanger, namespace: r.Namespace}, nil
	default:
		// With clientCredentials the connection controller keeps secure.token fresh, so it is read like any bearer token.
		token, err := e.decrypter(r).Token(ctx)
		if err != nil {
			return nil, fmt.Errorf("unable to decrypt token: %w", err)
		}
		if token.IsZero() {
			return nil, nil
		}
		return bearerAuth{token: string(token)}, nil
	}
}

func authType(cfg *provisioning.SourceRepositoryConfig) provisioning.SourceAuthType {
	if cfg == nil || cfg.Auth == nil || cfg.Auth.Type == "" {
		return provisioning.SourceAuthBearer
	}
	return cfg.Auth.Type
}

// client returns the shared client of a source. A change of URL or TLS settings gets a new one.
func (e *extra) client(cfg *provisioning.SourceRepositoryConfig) (*sourceClient, error) {
	key := cfg.URL
	if cfg.TLS != nil {
		key += "\x00" + cfg.TLS.ServerName + "\x00" + cfg.TLS.CABundle
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	if sc, ok := e.sources[key]; ok {
		return sc, nil
	}

	transport := http.DefaultTransport.(*http.Transport).Clone()
	dialer := &net.Dialer{Timeout: 10 * time.Second, KeepAlive: 30 * time.Second}
	if e.urlValidator != nil {
		transport.DialContext = e.urlValidator.DialContext(dialer)
	} else {
		transport.DialContext = dialer.DialContext
	}
	if cfg.TLS != nil {
		tlsConfig, err := tlsConfig(cfg.TLS)
		if err != nil {
			return nil, err
		}
		transport.TLSClientConfig = tlsConfig
	}

	sc := &sourceClient{state: &State{}, http: &http.Client{Transport: transport}}
	e.sources[key] = sc
	return sc, nil
}

func tlsConfig(cfg *provisioning.SourceTLS) (*tls.Config, error) {
	roots, err := x509.SystemCertPool()
	if err != nil {
		roots = x509.NewCertPool()
	}
	if cfg.CABundle != "" && !roots.AppendCertsFromPEM([]byte(cfg.CABundle)) {
		return nil, fmt.Errorf("spec.source.tls.caBundle contains no valid PEM certificate")
	}
	return &tls.Config{RootCAs: roots, ServerName: cfg.ServerName, MinVersion: tls.VersionTLS12}, nil
}

func (e *extra) Mutate(context.Context, runtime.Object, runtime.Object) error {
	return nil
}

func (e *extra) Validate(_ context.Context, obj runtime.Object) field.ErrorList {
	repo, ok := obj.(*provisioning.Repository)
	if !ok || repo.Spec.Type != provisioning.SourceRepositoryType {
		return nil
	}

	cfg := repo.Spec.Source
	if cfg == nil {
		return field.ErrorList{
			field.Required(field.NewPath("spec", "source"), "source configuration is required for source repository type"),
		}
	}

	var list field.ErrorList
	list = append(list, validateURL(cfg.URL, e.allowInsecure)...)
	list = append(list, validateAuth(repo)...)
	list = append(list, validateAllow(cfg.Allow)...)
	list = append(list, validatePolicy(cfg.EmptyTreePolicy)...)
	if cfg.TLS != nil && cfg.TLS.CABundle != "" {
		if _, err := tlsConfig(cfg.TLS); err != nil {
			list = append(list, field.Invalid(field.NewPath("spec", "source", "tls", "caBundle"), "[REDACTED]", "must contain at least one PEM certificate"))
		}
	}

	if len(repo.Spec.Workflows) > 0 {
		list = append(list, field.Invalid(field.NewPath("spec", "workflows"), repo.Spec.Workflows,
			"source repositories are read-only"))
	}
	if repo.Spec.Commit != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "commit"), repo.Spec.Commit,
			"commit options are not supported on source repositories"))
	}
	if repo.Spec.Branch != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "branch"), repo.Spec.Branch,
			"branch options are not supported on source repositories"))
	}
	if repo.Spec.PullRequest != nil {
		list = append(list, field.Invalid(field.NewPath("spec", "pullRequest"), repo.Spec.PullRequest,
			"pull request options are not supported on source repositories"))
	}
	return list
}

func validateURL(raw string, allowInsecure bool) field.ErrorList {
	path := field.NewPath("spec", "source", "url")
	if raw == "" {
		return field.ErrorList{field.Required(path, "a source url is required")}
	}

	u, err := url.Parse(raw)
	switch {
	case err != nil || u.Host == "":
		return field.ErrorList{field.Invalid(path, raw, "invalid source URL")}
	case u.Scheme != "https" && (!allowInsecure || u.Scheme != "http"):
		return field.ErrorList{field.Invalid(path, raw, "source URL must use https://")}
	case u.User != nil || u.RawQuery != "" || u.ForceQuery || u.Fragment != "":
		return field.ErrorList{field.Invalid(path, raw, "source URL must not contain credentials, a query or a fragment")}
	}
	return nil
}

// validateAuth keeps each auth mode to the credentials it actually uses.
func validateAuth(repo *provisioning.Repository) field.ErrorList {
	path := field.NewPath("spec", "source", "auth", "type")
	hasToken := !repo.Secure.Token.IsZero()
	hasConnection := repo.HasConnection()

	switch typ := authType(repo.Spec.Source); typ {
	case provisioning.SourceAuthBearer:
		if hasConnection {
			return field.ErrorList{field.Invalid(field.NewPath("spec", "connection"), repo.Spec.Connection.Name,
				"a connection is only used with clientCredentials; use secure.token for bearer")}
		}
	case provisioning.SourceAuthClientCredentials:
		// secure.token is allowed: the controller writes the token it mints from the connection there.
		if !hasConnection {
			return field.ErrorList{field.Required(field.NewPath("spec", "connection", "name"), "clientCredentials needs a source connection")}
		}
	case provisioning.SourceAuthTokenExchange:
		if hasConnection || hasToken {
			return field.ErrorList{field.Invalid(path, typ, "tokenExchange takes no token and no connection")}
		}
	default:
		return field.ErrorList{field.NotSupported(path, typ, []string{
			string(provisioning.SourceAuthBearer), string(provisioning.SourceAuthClientCredentials), string(provisioning.SourceAuthTokenExchange),
		})}
	}
	return nil
}

func validateAllow(allow []provisioning.SourceAllowedKind) field.ErrorList {
	var list field.ErrorList
	for i, a := range allow {
		path := field.NewPath("spec", "source", "allow").Index(i)
		if a.Group == "" {
			list = append(list, field.Required(path.Child("group"), "a group is required"))
		}
		if a.Kind == "" {
			list = append(list, field.Required(path.Child("kind"), "a kind is required"))
		}
	}
	return list
}

func validatePolicy(p provisioning.SourceEmptyTreePolicy) field.ErrorList {
	switch p {
	case "", provisioning.SourceEmptyTreeRefuse, provisioning.SourceEmptyTreeAllow:
		return nil
	}
	return field.ErrorList{field.NotSupported(field.NewPath("spec", "source", "emptyTreePolicy"), p,
		[]string{string(provisioning.SourceEmptyTreeRefuse), string(provisioning.SourceEmptyTreeAllow)})}
}
