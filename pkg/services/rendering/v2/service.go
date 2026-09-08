package v2

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

const (
	rendererAuthTokenHeader = "X-Auth-Token" // #nosec G101 -- header name, not a credential
	rateLimiterHeader       = "X-Tenant-ID"
	acceptLanguageHeader    = "Accept-Language"
	authorizationCleanupMax = 5 * time.Second
)

var (
	ErrConcurrentLimitReached = errors.New("rendering concurrent limit reached")
	ErrResponseTooLarge       = errors.New("renderer response exceeds configured byte limit")
	ErrServerTimeout          = errors.New("renderer request timed out")
	ErrTooManyRequests        = errors.New("renderer rejected too many requests")
)

type Service struct {
	configurations ConfigurationProvider
	authenticator  CallbackAuthenticator
	client         *http.Client
	versions       *rendererVersionCache
	limits         Limits
	inProgress     atomic.Int32
	version        atomic.Pointer[string]
}

type ServiceOption func(*serviceOptions) error

type serviceOptions struct {
	client *http.Client
}

func WithHTTPClient(client *http.Client) ServiceOption {
	return func(options *serviceOptions) error {
		if client == nil {
			return errors.New("configure rendering v2 service: HTTP client is required")
		}
		options.client = client
		return nil
	}
}

func NewService(configurations ConfigurationProvider, authenticator CallbackAuthenticator, limits Limits, functionalOptions ...ServiceOption) (*Service, error) {
	if configurations == nil {
		return nil, errors.New("create rendering v2 service: configuration provider is required")
	}
	if authenticator == nil {
		return nil, errors.New("create rendering v2 service: callback authenticator is required")
	}
	if limits.responseBytes.bytes <= 0 {
		return nil, errors.New("create rendering v2 service: parsed limits are required")
	}
	options := serviceOptions{}
	for _, applyOption := range functionalOptions {
		if applyOption == nil {
			return nil, errors.New("create rendering v2 service: nil option")
		}
		if err := applyOption(&options); err != nil {
			return nil, err
		}
	}
	if options.client == nil {
		client, err := newHTTPClient("")
		if err != nil {
			return nil, err
		}
		options.client = client
	}

	return &Service{
		configurations: configurations,
		authenticator:  authenticator,
		client:         options.client,
		versions:       newRendererVersionCache(),
		limits:         limits,
	}, nil
}

func (s *Service) Run(ctx context.Context) error {
	<-ctx.Done()
	s.client.CloseIdleConnections()
	return nil
}

func (s *Service) IsAvailable(ctx context.Context) (bool, error) {
	configuration, err := s.configurations.Get(ctx)
	if err != nil {
		return false, fmt.Errorf("get rendering configuration: %w", err)
	}
	return configuration.Available(), nil
}

func (s *Service) Version() string {
	version := s.version.Load()
	if version == nil {
		return ""
	}
	return *version
}

func (s *Service) Render(ctx context.Context, request Request) (*Result, error) {
	configuration, err := s.configurations.Get(ctx)
	if err != nil {
		return nil, fmt.Errorf("get rendering configuration: %w", err)
	}
	enabled, err := configuration.enabled()
	if err != nil {
		return nil, err
	}
	if request.renderType == RenderPDF {
		if err := s.isCapabilitySupported(ctx, enabled, CapabilityPDFRendering); err != nil {
			return nil, err
		}
	}

	inProgress := s.inProgress.Add(1)
	if request.concurrentLimit.value > 0 && inProgress > request.concurrentLimit.value {
		s.inProgress.Add(-1)
		return nil, ErrConcurrentLimitReached
	}
	releaseConcurrency := true
	defer func() {
		if releaseConcurrency {
			s.inProgress.Add(-1)
		}
	}()

	authorization, err := s.authenticator.Authorize(ctx, AuthorizationRequest{
		headers:  request.headers,
		identity: request.identity,
		secret:   enabled.rendererAuthToken,
		lifetime: enabled.renderKeyLifetime,
	})
	if err != nil {
		return nil, fmt.Errorf("authorize renderer callback: %w", err)
	}
	if !authorization.valid() {
		return nil, errors.New("authorize renderer callback: authenticator returned invalid authorization")
	}
	releaseAuthorization := true
	defer func() {
		if releaseAuthorization {
			closeCallbackAuthorization(ctx, authorization)
		}
	}()

	rendererRequestURL, err := buildRendererRequestURL(enabled, request, authorization)
	if err != nil {
		return nil, err
	}
	client, releaseClient, err := s.clientFor(enabled.rendererCACertPath)
	if err != nil {
		return nil, err
	}
	releaseHTTPClient := true
	defer func() {
		if releaseHTTPClient {
			releaseClient()
		}
	}()

	requestContext, cancelRequest := context.WithTimeout(ctx, request.timeout.request)
	httpRequest, err := http.NewRequestWithContext(requestContext, http.MethodGet, rendererRequestURL.String(), nil)
	if err != nil {
		cancelRequest()
		return nil, fmt.Errorf("create renderer request: %w", err)
	}
	for _, value := range request.headers.Values(acceptLanguageHeader) {
		httpRequest.Header.Add(acceptLanguageHeader, value)
	}
	query := httpRequest.URL.Query()
	authorization.apply(query, httpRequest.Header)
	httpRequest.URL.RawQuery = query.Encode()
	httpRequest.Header.Set(rendererAuthTokenHeader, enabled.rendererAuthToken.value)
	httpRequest.Header.Set(rateLimiterHeader, enabled.rendererTenantID.value)
	httpRequest.Header.Set("User-Agent", "Grafana/"+enabled.buildVersion)

	response, err := client.Do(httpRequest)
	if err != nil {
		cancelRequest()
		var urlError *url.Error
		if errors.As(err, &urlError) && urlError.Timeout() {
			return nil, ErrServerTimeout
		}
		return nil, fmt.Errorf("send renderer request: %w", err)
	}
	if response.StatusCode != http.StatusOK {
		_ = response.Body.Close()
		cancelRequest()
		switch response.StatusCode {
		case http.StatusTooManyRequests:
			return nil, ErrTooManyRequests
		case http.StatusRequestTimeout:
			return nil, ErrServerTimeout
		default:
			return nil, fmt.Errorf("renderer request failed: status code %d", response.StatusCode)
		}
	}
	if response.ContentLength > s.limits.responseBytes.bytes {
		_ = response.Body.Close()
		cancelRequest()
		return nil, ErrResponseTooLarge
	}

	name, err := parseResponseFileName(request.renderType, response.Header)
	if err != nil {
		_ = response.Body.Close()
		cancelRequest()
		return nil, err
	}

	result := newResult(response.Body, request.renderType, name, s.limits.responseBytes, func() {
		cancelRequest()
		closeCallbackAuthorization(ctx, authorization)
		releaseClient()
		s.inProgress.Add(-1)
	})
	releaseHTTPClient = false
	releaseAuthorization = false
	releaseConcurrency = false
	return result, nil
}

func closeCallbackAuthorization(ctx context.Context, authorization CallbackAuthorization) {
	cleanupContext, cancel := context.WithTimeout(context.WithoutCancel(ctx), authorizationCleanupMax)
	defer cancel()
	authorization.close(cleanupContext)
}

func (s *Service) AuthenticateRenderKey(ctx context.Context, value string) (RenderUser, bool) {
	key, err := ParseRenderKey(value)
	if err != nil {
		return RenderUser{}, false
	}
	configuration, err := s.configurations.Get(ctx)
	if err != nil {
		return RenderUser{}, false
	}
	enabled, err := configuration.enabled()
	if err != nil {
		return RenderUser{}, false
	}
	return s.authenticator.Authenticate(ctx, key, AuthenticationConfiguration{
		secret:   enabled.rendererAuthToken,
		lifetime: enabled.renderKeyLifetime,
	})
}

func buildRendererRequestURL(cfg enabledConfiguration, request Request, authorization CallbackAuthorization) (*url.URL, error) {
	renderer := *cfg.rendererURL.url
	if request.renderType == RenderCSV {
		renderer.Path = strings.TrimRight(renderer.Path, "/") + "/csv"
	}

	callback := *cfg.callbackURL.url
	callbackPath := request.callbackPath.url
	callback.Path = strings.TrimRight(callback.Path, "/") + "/" + strings.TrimLeft(callbackPath.Path, "/")
	callback.RawPath = ""
	callback.RawQuery = callbackPath.RawQuery
	callbackQuery := callback.Query()
	callbackQuery.Set("render", "1")
	callback.RawQuery = callbackQuery.Encode()

	query := renderer.Query()
	query.Set("url", callback.String())
	query.Set("domain", cfg.callbackDomain.value)
	query.Set("timezone", isoTimeOffsetToPOSIX(request.timezone.value))
	query.Set("encoding", string(request.renderType))
	query.Set("timeout", strconv.FormatInt(int64(request.timeout.renderer/time.Second), 10))
	if request.renderType == RenderPNG {
		query.Set("width", strconv.Itoa(request.width.value))
		query.Set("height", strconv.Itoa(request.height.rendererValue()))
	}
	if request.renderType != RenderCSV {
		query.Set("deviceScaleFactor", strconv.FormatFloat(request.deviceScale.value, 'f', 6, 64))
	}
	authorization.apply(query, http.Header{})
	renderer.RawQuery = query.Encode()
	return &renderer, nil
}

func isoTimeOffsetToPOSIX(value string) string {
	if strings.HasPrefix(value, "UTC+") {
		return strings.Replace(value, "UTC+", "UTC-", 1)
	}
	if strings.HasPrefix(value, "UTC-") {
		return strings.Replace(value, "UTC-", "UTC+", 1)
	}
	return value
}

type fileName struct {
	value string
	set   bool
}

func parseResponseFileName(renderType RenderType, headers http.Header) (fileName, error) {
	if renderType != RenderCSV {
		return fileName{}, nil
	}
	_, parameters, err := mime.ParseMediaType(headers.Get("Content-Disposition"))
	if err != nil {
		return fileName{}, fmt.Errorf("parse renderer content disposition: %w", err)
	}
	name := parameters["filename"]
	if name == "" || strings.ContainsAny(name, `/\\`) {
		return fileName{}, errors.New("parse renderer content disposition: safe filename is required")
	}
	return fileName{value: name, set: true}, nil
}

func (s *Service) clientFor(certificatePath string) (*http.Client, func(), error) {
	if certificatePath == "" {
		return s.client, func() {}, nil
	}
	client, err := newHTTPClient(certificatePath)
	if err != nil {
		return nil, nil, err
	}
	return client, client.CloseIdleConnections, nil
}

func newHTTPClient(certificatePath string) (*http.Client, error) {
	transport := &http.Transport{
		Proxy: http.ProxyFromEnvironment,
		DialContext: (&net.Dialer{
			Timeout: 30 * time.Second,
		}).DialContext,
		TLSHandshakeTimeout: 5 * time.Second,
	}
	if certificatePath != "" {
		// The parsed per-tenant configuration deliberately controls the trust store.
		//nolint:gosec
		certificate, err := os.ReadFile(certificatePath)
		if err != nil {
			return nil, fmt.Errorf("read renderer CA certificate: %w", err)
		}
		certificatePool := x509.NewCertPool()
		if !certificatePool.AppendCertsFromPEM(certificate) {
			return nil, errors.New("parse renderer CA certificate: no certificates found")
		}
		transport.TLSClientConfig = &tls.Config{RootCAs: certificatePool}
	}
	return &http.Client{Transport: otelhttp.NewTransport(transport)}, nil
}

type Result struct {
	body       io.ReadCloser
	renderType RenderType
	fileName   fileName
	limit      responseBytesLimit
	release    func()
	closeOnce  sync.Once
	closeError error
}

func newResult(body io.ReadCloser, renderType RenderType, name fileName, limit responseBytesLimit, release func()) *Result {
	return &Result{body: body, renderType: renderType, fileName: name, limit: limit, release: release}
}

func (r *Result) WriteTo(writer io.Writer) (int64, error) {
	if r == nil || r.body == nil {
		return 0, errors.New("stream renderer response: result is closed")
	}
	return io.Copy(writer, &boundedReader{reader: r.body, remaining: r.limit.bytes})
}

func (r *Result) Close() error {
	if r == nil {
		return nil
	}
	r.closeOnce.Do(func() {
		if r.body != nil {
			r.closeError = r.body.Close()
			r.body = nil
		}
		if r.release != nil {
			r.release()
		}
	})
	return r.closeError
}

func (r *Result) RenderType() RenderType {
	return r.renderType
}

func (r *Result) ContentType() string {
	switch r.renderType {
	case RenderCSV:
		return "text/csv"
	case RenderPDF:
		return "application/pdf"
	default:
		return "image/png"
	}
}

func (r *Result) FileName() (string, bool) {
	return r.fileName.value, r.fileName.set
}

type boundedReader struct {
	reader    io.Reader
	remaining int64
}

func (r *boundedReader) Read(buffer []byte) (int, error) {
	if r.remaining > 0 {
		if int64(len(buffer)) > r.remaining {
			buffer = buffer[:r.remaining]
		}
		count, err := r.reader.Read(buffer)
		r.remaining -= int64(count)
		return count, err
	}
	var extra [1]byte
	count, err := r.reader.Read(extra[:])
	if count > 0 {
		return 0, ErrResponseTooLarge
	}
	return 0, err
}
