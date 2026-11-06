// Package baasbridge is a shim that lets Grafana call an operator written for
// apiextensions-apiserver through the plugin v3 client interface.
//
// Deprecated: operators should serve the plugin v3 gRPC services. This
// package will be removed once the remaining operators have moved.
package baasbridge

import (
	"bytes"
	"cmp"
	"context"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/proto"
	jsonpatch "gopkg.in/evanphx/json-patch.v4"
	admissionv1 "k8s.io/api/admission/v1"
	authenticationv1 "k8s.io/api/authentication/v1"
	apiextensionsv1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apimachinery/pkg/util/uuid"
	"k8s.io/apiserver/pkg/endpoints/request"

	"github.com/grafana/grafana-app-sdk/app"
	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
)

// defaultMaxResponseBytes bounds a webhook response when no limit is given.
const defaultMaxResponseBytes = 100 << 20

// routeChunkBytes is the most body one streamed route response carries.
const routeChunkBytes = 32 << 10

// admissionTimeout bounds each admission webhook call, as the Kubernetes
// default timeoutSeconds does for apiextensions-apiserver. Conversion calls
// have none there either, and are bounded by the request alone.
var admissionTimeout = 10 * time.Second

var _ appclientv3.Client = (*client)(nil)

// client calls an operator written for apiextensions-apiserver
// through the plugin v3 interface. Such an operator serves the Kubernetes
// webhooks (by default at /validate, /mutate and /convert) and its custom
// routes under their /apis paths over HTTP, rather than the v3 gRPC services.
//
// It is a transition path: the operator is expected to move to gRPC.
type client struct {
	base             *url.URL
	client           *http.Client
	maxResponseBytes int64
	credentials      func(context.Context, http.Header) error
	// kinds holds the admission hooks the manifest declares for each kind. One
	// v3 review covers both hooks, but the operator serves each at its own
	// endpoint, and fails a review for a kind it has no hook for.
	kinds    map[schema.GroupVersionKind]httpAdmissionKind
	webhooks app.ManifestOperatorWebhookProperties
}

type httpAdmissionKind struct {
	plural     string
	validation map[pluginv3.AdmissionReviewRequest_Operation]bool
	mutation   map[pluginv3.AdmissionReviewRequest_Operation]bool
}

// IsHTTPHost reports whether a deployment host names an operator served over
// HTTP, rather than a gRPC address.
//
// Deprecated: see the package documentation.
func IsHTTPHost(host string) bool {
	scheme, _, ok := strings.Cut(host, "://")
	return ok && (strings.EqualFold(scheme, "http") || strings.EqualFold(scheme, "https"))
}

// Options configures a client.
//
// Deprecated: see the package documentation.
type Options struct {
	// HTTPClient sends the requests; nil uses a zero http.Client. Redirects are
	// never followed, whatever its CheckRedirect.
	HTTPClient *http.Client
	// MaxResponseBytes limits webhook responses; <= 0 uses a default.
	MaxResponseBytes int64
	// RouteCredentials adds the caller's credentials to a route request. An
	// error fails the call before it is sent. Nil sends none. Webhook requests
	// never carry them, as apiextensions-apiserver sends none to webhooks.
	RouteCredentials func(ctx context.Context, header http.Header) error
}

// NewClient returns a plugin v3 client for the operator at host, an http or
// https URL.
//
// The client authenticates only with opts.RouteCredentials. Wrapping it with
// the v3 authentication of the gRPC clients would exchange a token it never
// sends.
//
// manifest declares the operator's admission hooks, and is the only way to know
// them: one v3 review asks for both hooks, but the operator serves each at its
// own endpoint, and answers a kind without that hook with a plain-text 500 that
// is indistinguishable from a real failure, short of matching app-sdk's error
// text. Its operator.webhooks names the webhook paths. Routes do not use it.
//
// Deprecated: see the package documentation.
func NewClient(host string, manifest *app.ManifestData, opts Options) (appclientv3.Client, error) {
	base, err := url.Parse(host)
	if err != nil {
		return nil, fmt.Errorf("baasbridge: parsing plugin host %q: %w", host, err)
	}
	// url.Parse lowercases the scheme.
	if (base.Scheme != "http" && base.Scheme != "https") || base.Host == "" {
		return nil, fmt.Errorf("baasbridge: plugin host %q must be an absolute http or https URL", host)
	}
	httpClient := &http.Client{}
	if opts.HTTPClient != nil {
		*httpClient = *opts.HTTPClient
	}
	// Following a redirect would send the caller's credentials, which net/http
	// copies onto the redirected request, to wherever it points.
	httpClient.CheckRedirect = func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }
	maxResponseBytes := opts.MaxResponseBytes
	if maxResponseBytes <= 0 {
		maxResponseBytes = defaultMaxResponseBytes
	}
	return &client{
		base:             base,
		client:           httpClient,
		maxResponseBytes: maxResponseBytes,
		credentials:      opts.RouteCredentials,
		kinds:            httpAdmissionKinds(manifest),
		webhooks:         webhookPaths(manifest),
	}, nil
}

// webhookPaths returns the paths the manifest's operator serves its webhooks
// at. A missing or empty path is app-sdk's default, which is also what the
// AppManifest schema fills in for a missing one.
func webhookPaths(manifest *app.ManifestData) app.ManifestOperatorWebhookProperties {
	var paths app.ManifestOperatorWebhookProperties
	if manifest != nil && manifest.Operator != nil && manifest.Operator.Webhooks != nil {
		paths = *manifest.Operator.Webhooks
	}
	return app.ManifestOperatorWebhookProperties{
		ConversionPath: cmp.Or(paths.ConversionPath, "/convert"),
		ValidationPath: cmp.Or(paths.ValidationPath, "/validate"),
		MutationPath:   cmp.Or(paths.MutationPath, "/mutate"),
	}
}

// IsClient reports whether client was returned by NewClient.
//
// Deprecated: see the package documentation.
func IsClient(c appclientv3.Client) bool {
	_, ok := c.(*client)
	return ok
}

// NewTransport returns a traced transport for the clients of many operators;
// a nil tlsConfig uses the default TLS settings.
//
// responseHeaderTimeout bounds only the wait for a response's headers, so an
// operator that accepts a connection and never answers fails the call, while a
// watch streams its body for as long as it lasts. 0 waits for the request.
//
// Deprecated: see the package documentation.
func NewTransport(tlsConfig *tls.Config, responseHeaderTimeout time.Duration) http.RoundTripper {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.ResponseHeaderTimeout = responseHeaderTimeout
	// The default keeps 2 idle connections per host, so concurrent calls to one
	// operator would open a new connection, and TLS session, for most requests.
	// These match apiextensions-apiserver's custom-route proxy.
	transport.MaxIdleConns = 250
	transport.MaxIdleConnsPerHost = 50
	if tlsConfig != nil {
		transport.TLSClientConfig = tlsConfig.Clone()
	}
	return otelhttp.NewTransport(transport)
}

func httpAdmissionKinds(manifest *app.ManifestData) map[schema.GroupVersionKind]httpAdmissionKind {
	out := map[schema.GroupVersionKind]httpAdmissionKind{}
	if manifest == nil {
		return out
	}
	for _, version := range manifest.Versions {
		for _, kind := range version.Kinds {
			if kind.Admission == nil {
				continue
			}
			k := httpAdmissionKind{plural: strings.ToLower(kind.Plural)}
			if kind.Admission.Validation != nil {
				k.validation = httpAdmissionOperations(kind.Admission.Validation.Operations)
			}
			if kind.Admission.Mutation != nil {
				k.mutation = httpAdmissionOperations(kind.Admission.Mutation.Operations)
			}
			out[schema.GroupVersionKind{Group: manifest.Group, Version: version.Name, Kind: kind.Kind}] = k
		}
	}
	return out
}

func httpAdmissionOperations(ops []app.AdmissionOperation) map[pluginv3.AdmissionReviewRequest_Operation]bool {
	out := map[pluginv3.AdmissionReviewRequest_Operation]bool{}
	for _, op := range ops {
		switch op {
		case app.AdmissionOperationAny:
			out[pluginv3.AdmissionReviewRequest_OPERATION_CREATE] = true
			out[pluginv3.AdmissionReviewRequest_OPERATION_UPDATE] = true
			out[pluginv3.AdmissionReviewRequest_OPERATION_DELETE] = true
		case app.AdmissionOperationCreate:
			out[pluginv3.AdmissionReviewRequest_OPERATION_CREATE] = true
		case app.AdmissionOperationUpdate:
			out[pluginv3.AdmissionReviewRequest_OPERATION_UPDATE] = true
		case app.AdmissionOperationDelete:
			out[pluginv3.AdmissionReviewRequest_OPERATION_DELETE] = true
		case app.AdmissionOperationConnect:
			// The v3 review cannot express CONNECT.
		}
	}
	return out
}

func httpAdmissionOperation(op pluginv3.AdmissionReviewRequest_Operation) (admissionv1.Operation, bool) {
	switch op {
	case pluginv3.AdmissionReviewRequest_OPERATION_CREATE:
		return admissionv1.Create, true
	case pluginv3.AdmissionReviewRequest_OPERATION_UPDATE:
		return admissionv1.Update, true
	case pluginv3.AdmissionReviewRequest_OPERATION_DELETE:
		return admissionv1.Delete, true
	default:
		return "", false
	}
}

// AdmissionReview mutates and then validates, like the v3 admission service,
// so that validation sees the object as it will be stored.
func (c *client) AdmissionReview(ctx context.Context, in *pluginv3.AdmissionReviewRequest) (*pluginv3.AdmissionReviewResponse, error) {
	gvk := schema.GroupVersionKind{Group: in.GetKind().GetGroup(), Version: in.GetKind().GetVersion(), Kind: in.GetKind().GetKind()}
	kind, ok := c.kinds[gvk]
	if !ok {
		return nil, fmt.Errorf("baasbridge: the manifest declares no admission hooks for %s", gvk)
	}
	op, ok := httpAdmissionOperation(in.GetOperation())
	if !ok {
		return nil, fmt.Errorf("baasbridge: unsupported admission operation %s", in.GetOperation())
	}

	review := admissionCall{gvk: gvk, plural: kind.plural, op: op, oldObject: in.GetOldObjectBytes(), user: admissionUserInfo(ctx)}
	// Mutation can't rename the object; the store keeps the request's identity.
	review.meta = objectIdentity(in.GetObjectBytes())
	if review.meta.Name == "" {
		review.meta = objectIdentity(review.oldObject)
	}

	rsp := &pluginv3.AdmissionReviewResponse{}
	object := in.GetObjectBytes()
	var warnings []string
	if kind.mutation[in.GetOperation()] {
		result, err := c.admissionReview(ctx, c.webhooks.MutationPath, review, object)
		if err != nil {
			return nil, err
		}
		warnings = append(warnings, result.Warnings...)
		if !result.Allowed {
			return httpAdmissionDenied(result.Result, warnings), nil
		}
		// A delete review has no object to patch.
		if len(result.Patch) > 0 && len(object) > 0 {
			if result.PatchType == nil || *result.PatchType != admissionv1.PatchTypeJSONPatch {
				return nil, fmt.Errorf("baasbridge: mutating webhook for %s returned an unsupported patch type", gvk)
			}
			patch, err := jsonpatch.DecodePatch(result.Patch)
			if err != nil {
				return nil, fmt.Errorf("baasbridge: mutating webhook for %s returned an invalid patch: %w", gvk, err)
			}
			object, err = patch.Apply(object)
			if err != nil {
				return nil, fmt.Errorf("baasbridge: applying the patch from the mutating webhook for %s: %w", gvk, err)
			}
			rsp.SetObjectBytes(object)
		}
	}
	if kind.validation[in.GetOperation()] {
		result, err := c.admissionReview(ctx, c.webhooks.ValidationPath, review, object)
		if err != nil {
			return nil, err
		}
		warnings = append(warnings, result.Warnings...)
		if !result.Allowed {
			return httpAdmissionDenied(result.Result, warnings), nil
		}
	}
	rsp.SetAllowed(true)
	rsp.SetWarnings(warnings)
	return rsp, nil
}

// admissionCall holds what the mutating and validating calls of one review
// share.
type admissionCall struct {
	gvk       schema.GroupVersionKind
	plural    string
	op        admissionv1.Operation
	meta      metav1.ObjectMeta
	oldObject []byte
	user      authenticationv1.UserInfo
}

func (c *client) admissionReview(ctx context.Context, endpoint string, call admissionCall, object []byte) (*admissionv1.AdmissionResponse, error) {
	ctx, cancel := context.WithTimeout(ctx, admissionTimeout)
	defer cancel()

	gvk := call.gvk
	kind := metav1.GroupVersionKind{Group: gvk.Group, Version: gvk.Version, Kind: gvk.Kind}
	resource := metav1.GroupVersionResource{Group: gvk.Group, Version: gvk.Version, Resource: call.plural}
	req := &admissionv1.AdmissionRequest{
		UID:             uuid.NewUUID(),
		Kind:            kind,
		Resource:        resource,
		RequestKind:     &kind,
		RequestResource: &resource,
		Name:            call.meta.Name,
		Namespace:       call.meta.Namespace,
		Operation:       call.op,
		UserInfo:        call.user,
		Object:          runtime.RawExtension{Raw: object},
		OldObject:       runtime.RawExtension{Raw: call.oldObject},
	}
	review := &admissionv1.AdmissionReview{
		TypeMeta: metav1.TypeMeta{APIVersion: admissionv1.SchemeGroupVersion.String(), Kind: "AdmissionReview"},
		Request:  req,
	}
	out := &admissionv1.AdmissionReview{}
	if err := c.post(ctx, endpoint, review, out); err != nil {
		return nil, err
	}
	if out.Response == nil {
		return nil, fmt.Errorf("baasbridge: %s webhook for %s returned no response", endpoint, gvk)
	}
	if out.Response.UID != req.UID {
		return nil, fmt.Errorf("baasbridge: %s webhook for %s answered request %q, expected %q", endpoint, gvk, out.Response.UID, req.UID)
	}
	return out.Response, nil
}

// admissionUserInfo is the caller as the API server authenticated it, which
// apiextensions-apiserver sends its admission webhooks too.
func admissionUserInfo(ctx context.Context) authenticationv1.UserInfo {
	u, ok := request.UserFrom(ctx)
	if !ok || u == nil {
		return authenticationv1.UserInfo{}
	}
	info := authenticationv1.UserInfo{Username: u.GetName(), UID: u.GetUID(), Groups: u.GetGroups()}
	if extra := u.GetExtra(); len(extra) > 0 {
		info.Extra = make(map[string]authenticationv1.ExtraValue, len(extra))
		for key, values := range extra {
			info.Extra[key] = values
		}
	}
	return info
}

// objectIdentity reads the name and namespace of a JSON object, which the
// admission request names separately.
func objectIdentity(raw []byte) metav1.ObjectMeta {
	var obj struct {
		Metadata metav1.ObjectMeta `json:"metadata"`
	}
	if len(raw) > 0 {
		_ = json.Unmarshal(raw, &obj)
	}
	return obj.Metadata
}

func httpAdmissionDenied(result *metav1.Status, warnings []string) *pluginv3.AdmissionReviewResponse {
	rsp := &pluginv3.AdmissionReviewResponse{}
	rsp.SetAllowed(false)
	rsp.SetWarnings(warnings)
	if result != nil {
		rsp.SetError(statusResult(*result))
	}
	return rsp
}

// ConvertObjects sends the objects as one ConversionReview.
func (c *client) ConvertObjects(ctx context.Context, in *pluginv3.ConvertObjectsRequest) (*pluginv3.ConvertObjectsResponse, error) {
	uid := types.UID(in.GetUid())
	if uid == "" {
		uid = uuid.NewUUID()
	}
	objects := make([]runtime.RawExtension, len(in.GetObjects()))
	for i, raw := range in.GetObjects() {
		objects[i] = runtime.RawExtension{Raw: raw}
	}
	review := &apiextensionsv1.ConversionReview{
		TypeMeta: metav1.TypeMeta{APIVersion: apiextensionsv1.SchemeGroupVersion.String(), Kind: "ConversionReview"},
		Request: &apiextensionsv1.ConversionRequest{
			UID:               uid,
			DesiredAPIVersion: schema.GroupVersion{Group: in.GetTarget().GetGroup(), Version: in.GetTarget().GetVersion()}.String(),
			Objects:           objects,
		},
	}
	out := &apiextensionsv1.ConversionReview{}
	if err := c.post(ctx, c.webhooks.ConversionPath, review, out); err != nil {
		return nil, err
	}
	if out.Response == nil {
		return nil, errors.New("baasbridge: conversion webhook returned no response")
	}
	// apiextensions-apiserver checks both, and treats anything but Success as
	// a failure.
	if out.Response.UID != uid {
		return nil, fmt.Errorf("baasbridge: conversion webhook answered request %q, expected %q", out.Response.UID, uid)
	}

	rsp := &pluginv3.ConvertObjectsResponse{}
	rsp.SetUid(in.GetUid())
	if out.Response.Result.Status != metav1.StatusSuccess {
		result := out.Response.Result
		if result.Status == "" {
			result.Status = metav1.StatusFailure
		}
		if result.Message == "" {
			result.Message = fmt.Sprintf("response.result.status was %q, not %q", out.Response.Result.Status, metav1.StatusSuccess)
		}
		rsp.SetError(statusResult(result))
		return rsp, nil
	}
	converted := make([]*pluginv3.ConvertObjectsResponse_Object, len(out.Response.ConvertedObjects))
	for i, obj := range out.Response.ConvertedObjects {
		converted[i] = pluginv3.ConvertObjectsResponse_Object_builder{Raw: obj.Raw}.Build()
	}
	rsp.SetConverted(converted)
	return rsp, nil
}

// CallRoute serves the route at the request's URL path on the operator, which
// registers custom routes under their full /apis path.
func (c *client) CallRoute(ctx context.Context, in *pluginv3.CallRouteRequest) (grpc.ServerStreamingClient[pluginv3.CallRouteResponse], error) {
	u, err := url.Parse(in.GetUrl())
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "parsing route URL: %v", err)
	}
	// JoinPath takes escaped elements: the unescaped path would lose an escaped
	// "/" in a name, and fail to join one with an escaped "%".
	target := c.base.JoinPath(u.EscapedPath())
	target.RawQuery = u.RawQuery

	req, err := http.NewRequestWithContext(ctx, in.GetMethod(), target.String(), bytes.NewReader(in.GetBody()))
	if err != nil {
		return nil, status.Errorf(codes.InvalidArgument, "building route request: %v", err)
	}
	for key, values := range in.GetHeaders() {
		for _, value := range values.GetValues() {
			req.Header.Add(key, value)
		}
	}
	deleteHeaders(req.Header, hopByHopHeaders)
	deleteHeaders(req.Header, credentialHeaders)
	if err := c.setCredentials(ctx, req.Header); err != nil {
		return nil, err
	}

	// httpRouteStream closes the body at its end. A caller that stops receiving
	// before then leaves it to the request's context, which ends the response.
	resp, err := c.client.Do(req) //nolint:bodyclose
	if err != nil {
		return nil, transportError(ctx, err)
	}
	if isRedirect(resp) {
		_ = resp.Body.Close()
		return nil, errRouteRedirect(resp)
	}
	return newHTTPRouteStream(ctx, resp), nil
}

// isRedirect matches the responses the router's proxies refuse to relay. A 304
// has no Location, and passes.
func isRedirect(resp *http.Response) bool {
	return resp.StatusCode >= 300 && resp.StatusCode <= 399 && resp.Header.Get("Location") != ""
}

// errRouteRedirect answers a redirect with a 502, as the router's proxies do.
// It is a policy decision, not a sign the operator is unhealthy, so the
// breaker does not count it.
func errRouteRedirect(resp *http.Response) error {
	return &apierrors.StatusError{ErrStatus: metav1.Status{
		Status:  metav1.StatusFailure,
		Code:    http.StatusBadGateway,
		Reason:  metav1.StatusReasonInternalError,
		Message: fmt.Sprintf("baasbridge: backend redirect rejected (status %d, location %q)", resp.StatusCode, resp.Header.Get("Location")),
	}}
}

// post sends body as JSON to the endpoint and decodes the JSON response into out.
func (c *client) post(ctx context.Context, endpoint string, body, out any) error {
	data, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.base.JoinPath(endpoint).String(), bytes.NewReader(data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := c.client.Do(req)
	if err != nil {
		return transportError(ctx, err)
	}
	defer func() { _ = resp.Body.Close() }()
	if resp.StatusCode != http.StatusOK {
		msg, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<10))
		err := fmt.Errorf("baasbridge: %s webhook returned status %d: %s", endpoint, resp.StatusCode, strings.TrimSpace(string(msg)))
		if resp.StatusCode == http.StatusServiceUnavailable {
			return status.Error(codes.Unavailable, err.Error())
		}
		return err
	}
	var buf bytes.Buffer
	if resp.ContentLength > 0 && resp.ContentLength <= c.maxResponseBytes {
		// A conversion response holds every object, so growing to it would copy
		// it several times.
		buf.Grow(int(resp.ContentLength) + bytes.MinRead)
	}
	if _, err := buf.ReadFrom(io.LimitReader(resp.Body, c.maxResponseBytes+1)); err != nil {
		return transportError(ctx, err)
	}
	data = buf.Bytes()
	if int64(len(data)) > c.maxResponseBytes {
		return fmt.Errorf("baasbridge: %s webhook response is larger than %d bytes", endpoint, c.maxResponseBytes)
	}
	if err := json.Unmarshal(data, out); err != nil {
		return fmt.Errorf("baasbridge: decoding %s webhook response: %w", endpoint, err)
	}
	return nil
}

func (c *client) setCredentials(ctx context.Context, header http.Header) error {
	if c.credentials == nil {
		return nil
	}
	return c.credentials(ctx, header)
}

// transportError reports a failure to reach the operator as Unavailable, as
// the gRPC client does, so callers such as the router's breaker treat it the
// same way. A call that ran out of time, its own or the transport's wait for
// headers, is DeadlineExceeded, like a gRPC deadline.
func transportError(ctx context.Context, err error) error {
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return status.Error(codes.DeadlineExceeded, err.Error())
	}
	if ctx.Err() != nil {
		return ctx.Err()
	}
	var netErr net.Error
	if errors.As(err, &netErr) && netErr.Timeout() {
		return status.Error(codes.DeadlineExceeded, err.Error())
	}
	return status.Error(codes.Unavailable, err.Error())
}

func statusResult(s metav1.Status) *pluginv3.StatusResult {
	out := &pluginv3.StatusResult{}
	out.SetStatus(s.Status)
	out.SetMessage(s.Message)
	out.SetReason(string(s.Reason))
	out.SetCode(s.Code)
	if d := s.Details; d != nil {
		details := &pluginv3.StatusDetails{}
		details.SetName(d.Name)
		details.SetGroup(d.Group)
		details.SetKind(d.Kind)
		details.SetUid(string(d.UID))
		details.SetRetryAfterSeconds(d.RetryAfterSeconds)
		causes := make([]*pluginv3.StatusCause, len(d.Causes))
		for i, cause := range d.Causes {
			causes[i] = &pluginv3.StatusCause{}
			causes[i].SetReason(string(cause.Type))
			causes[i].SetMessage(cause.Message)
			causes[i].SetField(cause.Field)
		}
		details.SetCauses(causes)
		out.SetDetails(details)
	}
	return out
}

// credentialHeaders, or header prefixes (ending in "-"), assert who a route
// request acts as. Only Options.RouteCredentials may set them; the others would
// let a caller assert an identity themselves, as a trusted proxy does.
var credentialHeaders = []string{
	"Authorization", "Proxy-Authorization", "Cookie",
	"X-Access-Token", "X-Grafana-Id", "X-Id-Token",
	"X-Remote-User", "X-Remote-Group", "X-Remote-Extra-", "X-Webauth-", "Impersonate-",
}

// hopByHopHeaders apply to one HTTP connection, so they are not passed on in
// either direction. Upgrade in particular: the stream cannot carry one.
var hopByHopHeaders = []string{"Connection", "Keep-Alive", "Proxy-Connection", "Te", "Trailer", "Transfer-Encoding", "Upgrade"}

// deleteHeaders removes each named header, and every header starting with a
// name that ends in "-".
func deleteHeaders(header http.Header, names []string) {
	for _, name := range names {
		if !strings.HasSuffix(name, "-") {
			header.Del(name)
			continue
		}
		prefix := http.CanonicalHeaderKey(name)
		for key := range header {
			if strings.HasPrefix(http.CanonicalHeaderKey(key), prefix) {
				delete(header, key)
			}
		}
	}
}

// httpRouteStream streams an HTTP response as v3 route responses: the first
// carries the status code and headers, and each after it a chunk of the body.
type httpRouteStream struct {
	ctx        context.Context
	resp       *http.Response
	buf        []byte
	sentHeader bool
	done       bool
}

func newHTTPRouteStream(ctx context.Context, resp *http.Response) *httpRouteStream {
	// Most route responses are small, so a known length that fits sizes the
	// buffer; one more byte lets the read of the whole body also see its end.
	size := routeChunkBytes
	if resp.ContentLength >= 0 && resp.ContentLength < routeChunkBytes {
		size = int(resp.ContentLength) + 1
	}
	return &httpRouteStream{
		ctx:  ctx,
		resp: resp,
		buf:  make([]byte, size),
	}
}

// Recv returns the status and headers first, without a body: an operator may
// flush them and then wait, as a watch does, and the caller must be able to
// send them, and settle the call, before any body arrives.
func (s *httpRouteStream) Recv() (*pluginv3.CallRouteResponse, error) {
	if !s.sentHeader {
		s.sentHeader = true
		out := &pluginv3.CallRouteResponse{}
		out.SetCode(int32(s.resp.StatusCode))
		header := s.resp.Header.Clone()
		deleteHeaders(header, hopByHopHeaders)
		headers := make(map[string]*pluginv3.StringList, len(header))
		for key, values := range header {
			headers[key] = pluginv3.StringList_builder{Values: values}.Build()
		}
		out.SetHeaders(headers)
		return out, nil
	}
	if s.done {
		return nil, io.EOF
	}
	n, err := s.resp.Body.Read(s.buf)
	for n == 0 && err == nil {
		n, err = s.resp.Body.Read(s.buf)
	}
	if err != nil {
		s.done = true
		_ = s.resp.Body.Close()
		if !errors.Is(err, io.EOF) {
			return nil, transportError(s.ctx, err)
		}
		if n == 0 {
			return nil, io.EOF
		}
	}
	out := &pluginv3.CallRouteResponse{}
	out.SetBody(bytes.Clone(s.buf[:n]))
	return out, nil
}

func (s *httpRouteStream) Header() (metadata.MD, error) { return metadata.MD{}, nil }
func (s *httpRouteStream) Trailer() metadata.MD         { return metadata.MD{} }
func (s *httpRouteStream) CloseSend() error             { return nil }
func (s *httpRouteStream) Context() context.Context     { return s.ctx }
func (s *httpRouteStream) SendMsg(any) error {
	return errors.New("baasbridge: route streams do not send messages")
}

func (s *httpRouteStream) RecvMsg(m any) error {
	out, ok := m.(*pluginv3.CallRouteResponse)
	if !ok {
		return fmt.Errorf("baasbridge: unexpected route message type %T", m)
	}
	res, err := s.Recv()
	if err != nil {
		return err
	}
	proto.Reset(out)
	proto.Merge(out, res)
	return nil
}
