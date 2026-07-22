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

func (b *APIBuilder) proxyAllFlagReq(ctx context.Context, isAuthedUser bool, namespace string, w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(ctx, "ofrep.proxy.evalAllFlags")
	defer span.End()

	r = r.WithContext(ctx)

	proxy, err := b.newProxy(ofrepPath, namespace)
	if err != nil {
		err = tracing.Error(span, err)
		b.logger.Error("Failed to create proxy", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode != http.StatusOK {
			return nil
		}

		// Unauth is always filtered to public flags. Authed is filtered only when the flag is on.
		if isAuthedUser && !bulkFlagEvalFilteringEnabled(ctx) {
			return nil
		}

		var result goffmodel.OFREPBulkEvaluateSuccessResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			b.logger.Error("Failed to decode bulk eval response", "error", err)
			return err
		}
		_ = resp.Body.Close()

		filteredFlags := make([]goffmodel.OFREPFlagBulkEvaluateSuccessResponse, 0, len(result.Flags))
		for _, f := range result.Flags {
			if isPublic(f.Metadata) {
				filteredFlags = append(filteredFlags, f)
			}
		}

		result.Flags = filteredFlags
		newBodyBytes, err := json.Marshal(result)
		if err != nil {
			b.logger.Error("Failed to encode filtered result", "error", err)
			return err
		}

		rewriteResponse(resp, resp.StatusCode, newBodyBytes, "application/json")
		return nil
	}

	proxy.ServeHTTP(w, r)
}

func (b *APIBuilder) proxyFlagReq(ctx context.Context, flagKey string, isAuthedUser bool, namespace string, w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(ctx, "ofrep.proxy.evalFlag")
	defer span.End()

	r = r.WithContext(ctx)

	proxy, err := b.newProxy(path.Join(ofrepPath, flagKey), namespace)
	if err != nil {
		err = tracing.Error(span, err)
		b.logger.Error("Failed to create proxy", "key", flagKey, "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		// Unauth may only see public flags. Checked here since metadata is only known after eval.
		if resp.StatusCode != http.StatusOK || isAuthedUser {
			return nil
		}

		body, err := io.ReadAll(resp.Body)
		if err != nil {
			b.logger.Error("Failed to read flag eval response", "key", flagKey, "error", err)
			return err
		}
		_ = resp.Body.Close()

		var result goffmodel.OFREPEvaluateSuccessResponse
		if err := json.Unmarshal(body, &result); err != nil {
			b.logger.Error("Failed to decode flag eval response", "key", flagKey, "error", err)
			return err
		}

		if isPublic(result.Metadata) {
			resp.Body = io.NopCloser(bytes.NewReader(body))
			return nil
		}

		// Not public -> respond as if the flag doesn't exist, so an unauthed
		// caller can't use the 404-vs-401 distinction to probe which private
		// flags exist.
		b.logger.Debug("Unauthed request for non-public flag, responding as not-found", "key", flagKey)
		notFoundBody, err := json.Marshal(goffmodel.OFREPEvaluateErrorResponse{
			OFREPCommonErrorResponse: goffmodel.OFREPCommonErrorResponse{
				ErrorCode:    "FLAG_NOT_FOUND",
				ErrorDetails: fmt.Sprintf("Flag %q was not found", flagKey),
			},
			Key: flagKey,
		})
		if err != nil {
			return err
		}
		rewriteResponse(resp, http.StatusNotFound, notFoundBody, "application/json")
		return nil
	}

	proxy.ServeHTTP(w, r)
}

func (b *APIBuilder) newProxy(proxyPath, namespace string) (*httputil.ReverseProxy, error) {
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
		req.Header.Set("User-Agent", namespaceUserAgent(namespace))
	}

	proxy := proxyutil.NewReverseProxy(b.logger, director)
	proxy.Transport = b.transport
	return proxy, nil
}

func namespaceUserAgent(namespace string) string {
	if namespace == "" {
		return "features-grafana-app"
	}
	return "features-grafana-app/" + namespace
}

// rewriteResponse swaps a proxied response for a new one, so the reverse proxy
// forwards our content instead of the original upstream response.
func rewriteResponse(resp *http.Response, statusCode int, body []byte, contentType string) {
	resp.StatusCode = statusCode
	resp.Status = fmt.Sprintf("%d %s", statusCode, http.StatusText(statusCode))
	resp.Body = io.NopCloser(bytes.NewReader(body))
	resp.ContentLength = int64(len(body))
	resp.Header.Set("Content-Length", strconv.Itoa(len(body)))
	resp.Header.Set("Content-Type", contentType)
}
