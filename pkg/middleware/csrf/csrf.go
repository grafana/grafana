package csrf

import (
	"errors"
	"net/http"
	"net/url"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

type Service interface {
	Middleware(logger log.Logger) func(http.Handler) http.Handler
	TrustOrigin(origin string)
	AddOriginHeader(headerName string)
	AddSafeEndpoint(endpoint string)
}

type Implementation struct {
	cfg *setting.Cfg

	trustedOrigins map[string]struct{}
	originHeaders  map[string]struct{}
	safeEndpoints  map[string]struct{}
}

func ProvideCSRFFilter(cfg *setting.Cfg) Service {
	i := &Implementation{
		cfg:            cfg,
		trustedOrigins: map[string]struct{}{},
		originHeaders: map[string]struct{}{
			"Origin": {},
		},
		safeEndpoints: map[string]struct{}{},
	}

	additionalHeaders := cfg.SectionWithEnvOverrides("security").Key("csrf_additional_headers").Strings(" ")
	trustedOrigins := cfg.SectionWithEnvOverrides("security").Key("csrf_trusted_origins").Strings(" ")

	for _, header := range additionalHeaders {
		i.originHeaders[header] = struct{}{}
	}
	for _, origin := range trustedOrigins {
		i.trustedOrigins[origin] = struct{}{}
	}

	return i
}

func (i *Implementation) Middleware(logger log.Logger) func(http.Handler) http.Handler {
	// As per RFC 7231/4.2.2 these methods are idempotent:
	// (GET is excluded because it may have side effects in some APIs)
	safeMethods := []string{"HEAD", "OPTIONS", "TRACE"}

	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// If request has no login cookie - skip CSRF checks
			if _, err := r.Cookie(i.cfg.LoginCookieName); errors.Is(err, http.ErrNoCookie) {
				next.ServeHTTP(w, r)
				return
			}
			// Skip CSRF checks for "safe" methods
			for _, method := range safeMethods {
				if r.Method == method {
					next.ServeHTTP(w, r)
					return
				}
			}
			// Skip CSRF checks for "safe" endpoints
			for safeEndpoint := range i.safeEndpoints {
				if r.URL.Path == safeEndpoint {
					next.ServeHTTP(w, r)
					return
				}
			}
			// Otherwise - verify that Origin matches the server origin
			netAddr, err := util.SplitHostPortDefault(r.Host, "", "0") // we ignore the port
			if err != nil {
				http.Error(w, err.Error(), http.StatusBadRequest)
				return
			}
			origins := map[string]struct{}{}
			for header := range i.originHeaders {
				origin, err := url.Parse(r.Header.Get(header))
				if err != nil {
					logger.Error("error parsing Origin header", "header", header, "err", err)
				}
				if origin.String() != "" {
					origins[origin.Hostname()] = struct{}{}
				}
			}

			// No Origin header sent, skip CSRF check.
			if len(origins) == 0 {
				next.ServeHTTP(w, r)
				return
			}

			trustedOrigin := false
			for o := range i.trustedOrigins {
				if _, ok := origins[o]; ok {
					trustedOrigin = true
					break
				}
			}

			_, hostnameMatches := origins[netAddr.Host]
			if netAddr.Host == "" || !trustedOrigin && !hostnameMatches {
				http.Error(w, "origin not allowed", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func (i *Implementation) TrustOrigin(origin string) {
	i.trustedOrigins[origin] = struct{}{}
}

func (i *Implementation) AddOriginHeader(headerName string) {
	i.originHeaders[headerName] = struct{}{}
}

// AddSafeEndpoint is used for endpoints requests to skip CSRF check
func (i *Implementation) AddSafeEndpoint(endpoint string) {
	i.safeEndpoints[endpoint] = struct{}{}
}
