package ofrep

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"path"
	"strconv"

	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/proxyutil"

	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"
)

func (b *APIBuilder) proxyAllFlagReq(ctx context.Context, isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(ctx, "ofrep.proxy.evalAllFlags")
	defer span.End()

	r = r.WithContext(ctx)

	proxy, err := b.newProxy(ofrepPath)
	if err != nil {
		err = tracing.Error(span, err)
		b.logger.Error("Failed to create proxy", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

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

func (b *APIBuilder) proxyFlagReq(ctx context.Context, flagKey string, isAuthedUser bool, w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(ctx, "ofrep.proxy.evalFlag")
	defer span.End()

	r = r.WithContext(ctx)

	proxy, err := b.newProxy(path.Join(ofrepPath, flagKey))
	if err != nil {
		err = tracing.Error(span, err)
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

	director := func(req *http.Request) {
		req.URL.Scheme = b.url.Scheme
		req.URL.Host = b.url.Host
		req.URL.Path = proxyPath
	}

	proxy := proxyutil.NewReverseProxy(b.logger, director)
	proxy.Transport = b.transport
	return proxy, nil
}
