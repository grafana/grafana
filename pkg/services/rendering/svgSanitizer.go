package rendering

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
)

var (
	domPurifySvgConfig = map[string]interface{}{
		"USE_PROFILES": map[string]bool{"svg": true, "svgFilters": true},
		"ADD_TAGS":     []string{"use"},
	}
)

func (rs *RenderingService) sanitizeViaHTTP(ctx context.Context, req *SanitizeSVGRequest) (*SanitizeSVGResponse, error) {
	sanitizerUrl, err := url.Parse(rs.Cfg.RendererUrl + "/sanitize")
	if err != nil {
		return nil, err
	}

	bodyMap := map[string]interface{}{
		"content":         string(req.Content),
		"domPurifyConfig": domPurifySvgConfig,
		"contentType":     "image/svg+xml",
	}
	bodyJson, err := json.Marshal(bodyMap)
	if err != nil {
		rs.log.Error("Sanitizer - HTTP: failed to create the request body", "error", err, "filename", req.Filename)
		return nil, fmt.Errorf("body creation fail: %s", err)
	}

	reqContext, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(reqContext, "POST", sanitizerUrl.String(), bytes.NewReader(bodyJson))
	if err != nil {
		rs.log.Error("Sanitizer - HTTP: failed to create the HTTP request", "error", err, "filename", req.Filename)
		return nil, err
	}

	httpReq.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", rs.Cfg.BuildVersion))
	httpReq.Header.Set("Content-Type", "application/json")

	rs.log.Debug("Sanitizer - HTTP: calling", "filename", req.Filename, "contentLength", len(req.Content), "url", sanitizerUrl)
	// make request to renderer server
	resp, err := netClient.Do(httpReq)
	if err != nil {
		rs.log.Error("Sanitizer - HTTP: failed to send request", "error", err)
		return nil, fmt.Errorf("sanitizer - HTTP: failed to send request: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		rs.log.Error("Sanitizer - HTTP: failed to sanitize", "error", err)
		return nil, fmt.Errorf("sanitizer - HTTP: failed to sanitize %s", err)
	}

	sanitized, err := io.ReadAll(resp.Body)
	if err != nil {
		rs.log.Error("Sanitizer - HTTP: failed to read response body", "error", err, "filename", req.Filename)
		return nil, fmt.Errorf("sanitizer - HTTP: failed to read response body: %s", err)
	}

	return &SanitizeSVGResponse{Sanitized: sanitized}, nil
}

func (rs *RenderingService) sanitizeSVGViaPlugin(ctx context.Context, req *SanitizeSVGRequest) (*SanitizeSVGResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, time.Second*20)
	defer cancel()

	domPurifyConfig, err := json.Marshal(domPurifySvgConfig)
	if err != nil {
		rs.log.Error("Sanitizer - plugin: failed to parse domPurifyConfig")
		return nil, errors.New(fmt.Sprintf("Sanitizer - plugin: failed to parse domPurifyConfig %s", err))
	}
	grpcReq := &pluginextensionv2.SanitizeRequest{
		Filename:                  req.Filename,
		Content:                   req.Content,
		DomPurifyConfig:           domPurifyConfig,
		AllowAllLinksInSvgUseTags: false,
	}
	rs.log.Debug("Sanitizer - plugin: calling", "filename", req.Filename, "contentLength", len(req.Content))

	rsp, err := rs.pluginInfo.Renderer.Sanitize(ctx, grpcReq)
	if err != nil {
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			rs.log.Info("Sanitizer - plugin: time out")
			return nil, ErrTimeout
		}

		return nil, err
	}

	if rsp.Error != "" {
		return nil, fmt.Errorf("sanitizer - plugin: failed to sanitize: %s", rsp.Error)
	}

	return &SanitizeSVGResponse{Sanitized: rsp.Sanitized}, nil
}
