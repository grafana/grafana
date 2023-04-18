package csrf

import (
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"reflect"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service interface {
	Middleware() func(http.Handler) http.Handler
	TrustOrigin(origin string)
	AddAdditionalHeaders(headerName string)
	AddSafeEndpoint(endpoint string)
}

type CSRF struct {
	cfg *setting.Cfg

	trustedOrigins                       map[string]struct{}
	headers                              map[string]struct{}
	safeEndpoints                        map[string]struct{}
	skipCSRFCheckIfLoginCookieNotPresent bool
}

func ProvideCSRFFilter(cfg *setting.Cfg) *CSRF {
	c := &CSRF{
		cfg:            cfg,
		trustedOrigins: map[string]struct{}{},
		headers:        map[string]struct{}{},
		safeEndpoints:  map[string]struct{}{},
	}

	additionalHeaders := cfg.SectionWithEnvOverrides("security").Key("csrf_additional_headers").Strings(" ")
	trustedOrigins := cfg.SectionWithEnvOverrides("security").Key("csrf_trusted_origins").Strings(" ")
	c.skipCSRFCheckIfLoginCookieNotPresent = cfg.SectionWithEnvOverrides("security").Key("csrf_skip_check_if_login_cookie_not_present").MustBool(true)

	for _, header := range additionalHeaders {
		c.headers[header] = struct{}{}
	}
	for _, origin := range trustedOrigins {
		c.trustedOrigins[origin] = struct{}{}
	}

	return c
}

func (c *CSRF) Middleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			e := &errorWithStatus{}

			err := c.check(r)
			if err != nil {
				if !errors.As(err, &e) {
					http.Error(w, fmt.Sprintf("internal server error: expected error type errorWithStatus, got %s. Error: %v", reflect.TypeOf(err), err), http.StatusInternalServerError)
				}
				http.Error(w, err.Error(), e.HTTPStatus)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (c *CSRF) check(r *http.Request) error {
	// As per RFC 7231/4.2.2 these methods are idempotent:
	// (GET is excluded because it may have side effects in some APIs)
	safeMethods := []string{"HEAD", "OPTIONS", "TRACE"}

	// If request has no login cookie - skip CSRF checks
	if c.skipCSRFCheckIfLoginCookieNotPresent {
		if _, err := r.Cookie(c.cfg.LoginCookieName); errors.Is(err, http.ErrNoCookie) {
			return nil
		}
	}

	// Skip CSRF checks for "safe" methods
	for _, method := range safeMethods {
		if r.Method == method {
			return nil
		}
	}
	// Skip CSRF checks for "safe" endpoints
	for safeEndpoint := range c.safeEndpoints {
		if r.URL.Path == safeEndpoint {
			return nil
		}
	}
	// Otherwise - verify that Origin matches the server origin
	netAddr, err := util.SplitHostPortDefault(r.Host, "", "0") // we ignore the port
	if err != nil {
		return &errorWithStatus{Underlying: err, HTTPStatus: http.StatusBadRequest}
	}

	o := r.Header.Get("Origin")

	// No Origin header sent, skip CSRF check.
	if o == "" {
		return nil
	}

	originURL, err := url.Parse(o)
	if err != nil {
		return &errorWithStatus{Underlying: err, HTTPStatus: http.StatusBadRequest}
	}
	origin := originURL.Hostname()

	trustedOrigin := false
	for h := range c.headers {
		customHost := r.Header.Get(h)
		addr, err := util.SplitHostPortDefault(customHost, "", "0") // we ignore the port
		if err != nil {
			return &errorWithStatus{Underlying: err, HTTPStatus: http.StatusBadRequest}
		}
		if addr.Host == origin {
			trustedOrigin = true
			break
		}
	}

	for o := range c.trustedOrigins {
		if o == origin {
			trustedOrigin = true
			break
		}
	}

	hostnameMatches := origin == netAddr.Host
	if netAddr.Host == "" || !trustedOrigin && !hostnameMatches {
		return &errorWithStatus{Underlying: errors.New("origin not allowed"), HTTPStatus: http.StatusForbidden}
	}

	return nil
}

func (c *CSRF) TrustOrigin(origin string) {
	c.trustedOrigins[origin] = struct{}{}
}

func (c *CSRF) AddAdditionalHeaders(headerName string) {
	c.headers[headerName] = struct{}{}
}

// AddSafeEndpoint is used for endpoints requests to skip CSRF check
func (c *CSRF) AddSafeEndpoint(endpoint string) {
	c.safeEndpoints[endpoint] = struct{}{}
}

type errorWithStatus struct {
	Underlying error
	HTTPStatus int
}

func (e errorWithStatus) Error() string {
	return e.Underlying.Error()
}

func (e errorWithStatus) Unwrap() error {
	return e.Underlying
}
