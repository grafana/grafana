package ofrep

import (
	"bytes"
	"context"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httputil"
	"os"
	"path"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/proxyutil"

	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"
)

func (b *APIBuilder) proxyAllFlagReq(ctx context.Context, isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(ctx, "ofrep.proxy.evalAllFlags")
	defer span.End()

	r = r.WithContext(ctx)

	proxy := b.newProxy(ofrepPath)

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == http.StatusOK && !isAuthedUser {
			var result goffmodel.OFREPBulkEvaluateSuccessResponse
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				return err
			}
			_ = resp.Body.Close()

			var filteredFlags []goffmodel.OFREPFlagBulkEvaluateSuccessResponse
			for _, f := range result.Flags {
				if isPublicFlag(f.Key) {
					filteredFlags = append(filteredFlags, f)
				}
			}

			result.Flags = filteredFlags
			newBodyBytes, err := json.Marshal(result)
			if err != nil {
				b.logger.Error("Failed to encode filtered result", "error", err)
				return err
			}

			resp.Body = io.NopCloser(bytes.NewReader(newBodyBytes))
			resp.ContentLength = int64(len(newBodyBytes))
			resp.Header.Set("Content-Length", strconv.Itoa(len(newBodyBytes)))
			resp.Header.Set("Content-Type", "application/json")
		}

		return nil
	}

	proxy.ServeHTTP(w, r)
}

func (b *APIBuilder) proxyFlagReq(ctx context.Context, flagKey string, isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(ctx, "ofrep.proxy.evalFlag")
	defer span.End()

	r = r.WithContext(ctx)

	proxy := b.newProxy(path.Join(ofrepPath, flagKey))

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == http.StatusOK && !isAuthedUser && !isPublicFlag(flagKey) {
			writeResponse(http.StatusUnauthorized, struct{}{}, b.logger, w)
		}
		return nil
	}

	proxy.ServeHTTP(w, r)
}

func (b *APIBuilder) newProxy(proxyPath string) *httputil.ReverseProxy {
	director := func(req *http.Request) {
		req.URL.Scheme = b.url.Scheme
		req.URL.Host = b.url.Host
		req.URL.Path = proxyPath
	}

	proxy := proxyutil.NewReverseProxy(b.logger, director)
	proxy.Transport = b.transport
	return proxy
}

func newTransport(insecure bool, caFile string) (*http.Transport, error) {
	var caRoot *x509.CertPool
	if caFile != "" {
		var err error
		caRoot, err = getCARoot(caFile)
		if err != nil {
			return nil, err
		}
	}
	return &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: insecure, // nolint:gosec
			RootCAs:            caRoot,
		},
		MaxIdleConnsPerHost: 10, // keep more idle connections than the default (2) to avoid new TCP handshakes on every request
		IdleConnTimeout:     90 * time.Second,
	}, nil
}

func getCARoot(caFile string) (*x509.CertPool, error) {
	// It should be safe to ignore since caFile is passed as --internal.root-ca-file flag of apiserver
	// nolint:gosec
	caCert, err := os.ReadFile(caFile)
	if err != nil {
		return nil, err
	}
	caCertPool := x509.NewCertPool()
	caCertPool.AppendCertsFromPEM(caCert)
	return caCertPool, nil
}
