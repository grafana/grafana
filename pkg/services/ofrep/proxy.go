package ofrep

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"path"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/infra/features"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/util/proxyutil"
	goffmodel "github.com/thomaspoignant/go-feature-flag/cmd/relayproxy/model"
)

func (b *APIBuilder) proxyAllFlagReq(ctx context.Context, isAuthedUser bool, namespace string, w http.ResponseWriter, r *http.Request) {
	ctx, span := tracing.Start(ctx, "ofrep.proxy.evalAllFlags")
	defer span.End()

	r = r.WithContext(ctx)
	logger := b.logger.FromContext(ctx)

	target := b.upstreamForBulk(ctx, namespace, logger)
	if target != nil {
		logger.Debug("selected upstream for bulk eval", "namespace", namespace, "target", target.Host)
	}

	proxy, err := b.newProxy(ofrepPath, namespace, target, r.Header.Get("User-Agent"))
	if err != nil {
		err = tracing.Error(span, err)
		logger.Error("Failed to create proxy", "error", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	proxy.ModifyResponse = func(resp *http.Response) error {
		if resp.StatusCode != http.StatusOK {
			return nil
		}

		// Unauth is always filtered to public flags. Authed is filtered only when the flag is on.
		if isAuthedUser && !bulkFlagEvalFilteringEnabled(ctx, logger) {
			return nil
		}

		var result goffmodel.OFREPBulkEvaluateSuccessResponse
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			logger.Error("Failed to decode bulk eval response", "error", err)
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
			logger.Error("Failed to encode filtered result", "error", err)
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
	logger := b.logger.FromContext(ctx)

	target := b.upstreamForFlag(ctx, flagKey, namespace, logger)
	if target != nil {
		logger.Debug("selected upstream for flag eval", "key", flagKey, "namespace", namespace, "target", target.Host)
	}

	proxy, err := b.newProxy(path.Join(ofrepPath, flagKey), namespace, target, r.Header.Get("User-Agent"))
	if err != nil {
		err = tracing.Error(span, err)
		logger.Error("Failed to create proxy", "key", flagKey, "error", err)
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
			logger.Error("Failed to read flag eval response", "key", flagKey, "error", err)
			return err
		}
		_ = resp.Body.Close()

		var result goffmodel.OFREPEvaluateSuccessResponse
		if err := json.Unmarshal(body, &result); err != nil {
			logger.Error("Failed to decode flag eval response", "key", flagKey, "error", err)
			return err
		}

		if isPublic(result.Metadata) {
			resp.Body = io.NopCloser(bytes.NewReader(body))
			return nil
		}

		// Not public -> respond as if the flag doesn't exist, so an unauthed
		// caller can't use the 404-vs-401 distinction to probe which private
		// flags exist.
		logger.Debug("Unauthed request for non-public flag, responding as not-found", "namespace", namespace, "key", flagKey)
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

func isUnknownNamespace(namespace string) bool {
	return namespace == "" || namespace == "*"
}

func (b *APIBuilder) upstreamForFlag(ctx context.Context, flagKey, namespace string, logger log.Logger) *url.URL {
	if b.bypassEnabled(ctx, logger) && (isUnknownNamespace(namespace) || !b.hgOverrideFlags[flagKey]) {
		return b.goffURL
	}
	return b.url
}

func (b *APIBuilder) upstreamForBulk(ctx context.Context, namespace string, logger log.Logger) *url.URL {
	if b.bypassEnabled(ctx, logger) && isUnknownNamespace(namespace) {
		return b.goffURL
	}
	return b.url
}

func (b *APIBuilder) newProxy(proxyPath, namespace string, targetURL *url.URL, incomingUserAgent string) (*httputil.ReverseProxy, error) {
	if proxyPath == "" {
		return nil, fmt.Errorf("proxy path is required")
	}

	if targetURL == nil {
		return nil, fmt.Errorf("OpenFeatureService provider URL is not set")
	}

	director := func(req *http.Request) {
		req.URL.Scheme = targetURL.Scheme
		req.URL.Host = targetURL.Host
		req.URL.Path = proxyPath
		req.Header.Set("User-Agent", withStackTag(incomingUserAgent, namespace))
	}

	proxy := proxyutil.NewReverseProxy(b.logger, director)
	proxy.Transport = b.transport
	return proxy, nil
}

// maxUserAgentLen bounds a caller-supplied User-Agent before it's forwarded downstream.
const maxUserAgentLen = 150

func withStackTag(ua, ns string) string {
	if len(ua) > maxUserAgentLen {
		ua = ua[:maxUserAgentLen]
	}

	if strings.HasPrefix(ua, features.ClientUserAgentPrefix) {
		// Known format from our own HTTP client
		if ns == "" || strings.Contains(ua, " ns/"+ns) {
			return ua
		}
		return ua + " ns/" + ns
	}

	if ua == "" {
		ua = "unknown"
	}
	if ns == "" {
		return ua
	}
	return ua + " ns/" + ns
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
