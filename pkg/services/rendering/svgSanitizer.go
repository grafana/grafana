package rendering

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/textproto"
	"net/url"
	"time"

	"github.com/grafana/grafana/pkg/plugins/backendplugin/pluginextensionv2"
)

var (
	domPurifySvgConfig = map[string]interface{}{
		// domPurifyConfig is passed directly to DOMPurify https://github.com/cure53/DOMPurify#can-i-configure-dompurify
		"domPurifyConfig": map[string]interface{}{
			"USE_PROFILES": map[string]bool{"svg": true, "svgFilters": true},
			"ADD_TAGS":     []string{"use"},
		},
		// allowAllLinksInSvgUseTags will preserve all `use` tags.
		// By default, we remove all non-self-referential `use` tags, i.e. those which `href` attribute does not start with `#`
		"allowAllLinksInSvgUseTags": false,
	}
	domPurifyConfigType = "DOMPurify"
)

type formFile struct {
	fileName    string
	key         string
	contentType string
	content     io.Reader
}

func createMultipartRequestBody(values []formFile) (bytes.Buffer, string, error) {
	var b bytes.Buffer
	w := multipart.NewWriter(&b)
	for _, f := range values {
		h := make(textproto.MIMEHeader)
		h.Set("Content-Disposition", fmt.Sprintf(`form-data; name="%s"; filename="%s"`, f.key, f.fileName))
		h.Set("Content-Type", f.contentType)
		formWriter, err := w.CreatePart(h)

		if err != nil {
			return bytes.Buffer{}, "", err
		}

		if _, err := io.Copy(formWriter, f.content); err != nil {
			return bytes.Buffer{}, "", err
		}

		if x, ok := f.content.(io.Closer); ok {
			_ = x.Close()
		}
	}

	if err := w.Close(); err != nil {
		return bytes.Buffer{}, "", err
	}

	return b, w.FormDataContentType(), nil
}

func (rs *RenderingService) sanitizeViaHTTP(ctx context.Context, req *SanitizeSVGRequest) (*SanitizeSVGResponse, error) {
	sanitizerUrl, err := url.Parse(rs.sanitizeURL)
	if err != nil {
		return nil, err
	}

	configJson, err := json.Marshal(map[string]interface{}{
		"config":     domPurifySvgConfig,
		"configType": domPurifyConfigType,
	})
	if err != nil {
		rs.log.Error("Sanitizer - HTTP: failed to create the request config", "error", err, "filename", req.Filename)
		return nil, fmt.Errorf("config creation fail: %s", err)
	}

	body, contentType, err := createMultipartRequestBody([]formFile{
		{
			fileName:    "config",
			key:         "config",
			contentType: "application/json",
			content:     bytes.NewReader(configJson),
		},
		{
			fileName:    req.Filename,
			key:         "file",
			contentType: "image/svg+xml",
			content:     bytes.NewReader(req.Content),
		},
	})
	if err != nil {
		rs.log.Error("Sanitizer - HTTP: failed to create the request body", "error", err, "filename", req.Filename)
		return nil, fmt.Errorf("body creation fail: %s", err)
	}

	reqContext, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	httpReq, err := http.NewRequestWithContext(reqContext, "POST", sanitizerUrl.String(), &body)
	if err != nil {
		rs.log.Error("Sanitizer - HTTP: failed to create the HTTP request", "error", err, "filename", req.Filename)
		return nil, err
	}

	httpReq.Header.Set("User-Agent", fmt.Sprintf("Grafana/%s", rs.Cfg.BuildVersion))
	httpReq.Header.Set("Content-Type", contentType)

	rs.log.Debug("Sanitizer - HTTP: calling", "filename", req.Filename, "contentLength", len(req.Content), "url", sanitizerUrl)
	// make request to renderer server
	resp, err := netClient.Do(httpReq)
	if err != nil {
		rs.log.Error("Sanitizer - HTTP: failed to send request", "error", err)
		return nil, fmt.Errorf("sanitizer - HTTP: failed to send request: %w", err)
	}

	defer func() {
		if err := resp.Body.Close(); err != nil {
			rs.log.Error("Sanitizer - HTTP: failed to close response body", "statusCode", resp.StatusCode, "error", err)
		}
	}()

	if resp.StatusCode != http.StatusOK {
		if body, err := io.ReadAll(resp.Body); body != nil {
			rs.log.Error("Sanitizer - HTTP: failed to sanitize", "statusCode", resp.StatusCode, "error", err, "resp", string(body))
		} else {
			rs.log.Error("Sanitizer - HTTP: failed to sanitize", "statusCode", resp.StatusCode, "error", err)
		}
		return nil, fmt.Errorf("sanitizer - HTTP: failed to sanitize %s", req.Filename)
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
		return nil, fmt.Errorf("sanitizer - plugin: failed to parse domPurifyConfig %s", err)
	}
	grpcReq := &pluginextensionv2.SanitizeRequest{
		Filename:   req.Filename,
		Content:    req.Content,
		ConfigType: domPurifyConfigType,
		Config:     domPurifyConfig,
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
