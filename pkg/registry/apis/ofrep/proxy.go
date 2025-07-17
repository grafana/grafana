package ofrep

import (
	"bytes"
	"crypto/tls"
	"crypto/x509"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"os"
	"path"
	"strconv"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/util/proxyutil"
)

func (b *APIBuilder) proxyAllFlagReq(isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	proxy, err := b.newProxy(ofrepPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == http.StatusOK && !isAuthedUser {
			var result featuremgmt.OFREPBulkResponse
			if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
				return err
			}
			_ = resp.Body.Close()

			var filteredFlags []featuremgmt.OFREPFlag
			for _, f := range result.Flags {
				if isPublicFlag(f.Key) {
					filteredFlags = append(filteredFlags, f)
				}
			}

			result.Flags = filteredFlags
			newBodyBytes, err := json.Marshal(result)
			if err != nil {
				logger.Error("Failed to encode filtered result", "error", err)
				return err
			}

			// Replace the body
			resp.Body = io.NopCloser(bytes.NewReader(newBodyBytes))
			resp.ContentLength = int64(len(newBodyBytes))
			resp.Header.Set("Content-Length", strconv.Itoa(len(newBodyBytes)))
			resp.Header.Set("Content-Type", "application/json")
		}

		return nil
	}

	proxy.ServeHTTP(w, r)
}

func (b *APIBuilder) proxyFlagReq(flagKey string, isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	proxy, err := b.newProxy(path.Join(ofrepPath, flagKey))
	if err != nil {
		b.logger.Error("Failed to create proxy", "key", flagKey, "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode == http.StatusOK && !isAuthedUser && !isPublicFlag(flagKey) {
			writeResponse(http.StatusUnauthorized, struct{}{}, b.logger, w)
		}
		return nil
	}

	proxy.ServeHTTP(w, r)
}

func (b *APIBuilder) newProxy(proxyPath string) (*httputil.ReverseProxy, error) {
	if proxyPath == "" {
		return nil, fmt.Errorf("proxy path is required")
	}

	if b.url == nil {
		return nil, fmt.Errorf("OpenFeatureService provider URL is not set")
	}

	var caRoot *x509.CertPool
	if b.caFile != "" {
		var err error
		caRoot, err = getCARoot(b.caFile)
		if err != nil {
			return nil, err
		}
	}

	director := func(req *http.Request) {
		req.URL.Scheme = b.url.Scheme
		req.URL.Host = b.url.Host
		req.URL.Path = proxyPath
	}

	proxy := proxyutil.NewReverseProxy(b.logger, director)
	proxy.Transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: b.insecure,
			RootCAs:            caRoot,
		},
	}
	return proxy, nil
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
