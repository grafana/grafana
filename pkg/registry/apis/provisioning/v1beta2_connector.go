package provisioning

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v1beta2"
)

// v0alpha1Connector is a connector that reads and responds with v0alpha1 objects.
type v0alpha1Connector interface {
	rest.Storage
	rest.Connecter
}

// v1beta2Connector serves a v0alpha1 connector on v1beta2. The inner connector keeps working on
// v0alpha1: the objects it responds with are converted to v1beta2, and so are the types it
// declares, so the OpenAPI names v1beta2 types. Errors, raw writes and request bodies pass through,
// except for the bodies of methods given a request conversion.
type v1beta2Connector struct {
	inner    v0alpha1Connector
	scheme   *runtime.Scheme
	methods  []string
	requests map[string]v1beta2RequestConversion

	newObj   runtime.Object
	produces map[string]any
}

// v1beta2RequestConversion rewrites a typed v1beta2 request body into the body the inner connector
// reads. Empty bodies are passed through without calling Convert.
type v1beta2RequestConversion struct {
	// MaxBytes bounds the body read for the conversion; larger bodies are rejected with 413.
	MaxBytes int64
	Convert  func(body []byte) ([]byte, error)
}

type v1beta2ConnectorOption func(*v1beta2Connector)

// withV1beta2Methods serves only these methods of the inner connector.
func withV1beta2Methods(methods ...string) v1beta2ConnectorOption {
	return func(c *v1beta2Connector) {
		c.methods = methods
	}
}

// withV1beta2RequestBody converts the request bodies of these methods before the inner connector
// reads them.
func withV1beta2RequestBody(conversion v1beta2RequestConversion, methods ...string) v1beta2ConnectorOption {
	return func(c *v1beta2Connector) {
		for _, method := range methods {
			c.requests[method] = conversion
		}
	}
}

func newV1beta2Connector(scheme *runtime.Scheme, inner v0alpha1Connector, opts ...v1beta2ConnectorOption) (*v1beta2Connector, error) {
	c := &v1beta2Connector{
		inner:    inner,
		scheme:   scheme,
		methods:  inner.ConnectMethods(),
		requests: map[string]v1beta2RequestConversion{},
		produces: map[string]any{},
	}
	for _, opt := range opts {
		opt(c)
	}

	for _, method := range c.methods {
		if !slices.Contains(inner.ConnectMethods(), method) {
			return nil, fmt.Errorf("%T does not serve %s", inner, method)
		}
	}
	for method, conversion := range c.requests {
		if !slices.Contains(c.methods, method) {
			return nil, fmt.Errorf("request conversion for %s, which is not served", method)
		}
		if conversion.MaxBytes <= 0 || conversion.Convert == nil {
			return nil, fmt.Errorf("request conversion for %s needs a positive MaxBytes and a Convert function", method)
		}
	}

	newObj, err := v1beta2ConnectorType(scheme, inner.New())
	if err != nil {
		return nil, fmt.Errorf("%T: %w", inner, err)
	}
	c.newObj = newObj

	// Without a produced object, Kubernetes documents a connector response as a string.
	if meta, ok := inner.(rest.StorageMetadata); ok {
		for _, method := range c.methods {
			produced := meta.ProducesObject(method)
			if obj, ok := produced.(runtime.Object); ok {
				if produced, err = v1beta2ConnectorType(scheme, obj); err != nil {
					return nil, fmt.Errorf("%T %s: %w", inner, method, err)
				}
			}
			c.produces[method] = produced
		}
	}
	return c, nil
}

// v1beta2ConnectorType returns an empty v1beta2 object of the type of obj, which must convert to
// a v1beta2 type.
func v1beta2ConnectorType(scheme *runtime.Scheme, obj runtime.Object) (runtime.Object, error) {
	out, err := convertToV1beta2(scheme, obj.DeepCopyObject())
	if err != nil {
		return nil, err
	}
	if _, ok := v1beta2Kind(scheme, out); !ok {
		return nil, fmt.Errorf("%T has no %s counterpart", obj, v1beta2.GroupVersion)
	}
	return out, nil
}

// convertToV1beta2 converts a provisioning object of another version to v1beta2. Anything else,
// such as a v1beta2 object or a metav1.Status, is returned as is.
func convertToV1beta2(scheme *runtime.Scheme, obj runtime.Object) (runtime.Object, error) {
	kinds, _, err := scheme.ObjectKinds(obj)
	if err != nil {
		return obj, nil
	}
	for _, kind := range kinds {
		if kind.Group != v1beta2.APIGroup || kind.Version == v1beta2.APIVersion {
			continue
		}
		out, err := scheme.New(v1beta2.GroupVersion.WithKind(kind.Kind))
		if err != nil {
			return nil, fmt.Errorf("%s has no %s counterpart: %w", kind.Kind, v1beta2.GroupVersion, err)
		}
		if err := fromStorageVersion(scheme, obj, out); err != nil {
			return nil, fmt.Errorf("convert %s to %s: %w", kind.Kind, v1beta2.GroupVersion, err)
		}
		return out, nil
	}
	return obj, nil
}

func (c *v1beta2Connector) New() runtime.Object {
	return c.newObj.DeepCopyObject()
}

func (c *v1beta2Connector) Destroy() {
	c.inner.Destroy()
}

func (c *v1beta2Connector) ConnectMethods() []string {
	return c.methods
}

func (c *v1beta2Connector) NewConnectOptions() (runtime.Object, bool, string) {
	return c.inner.NewConnectOptions()
}

func (c *v1beta2Connector) ProducesMIMETypes(verb string) []string {
	if meta, ok := c.inner.(rest.StorageMetadata); ok {
		return meta.ProducesMIMETypes(verb)
	}
	return nil
}

func (c *v1beta2Connector) ProducesObject(verb string) any {
	return c.produces[verb]
}

func (c *v1beta2Connector) Connect(ctx context.Context, name string, opts runtime.Object, responder rest.Responder) (http.Handler, error) {
	handler, err := c.inner.Connect(ctx, name, opts, &v1beta2Responder{scheme: c.scheme, inner: responder})
	if err != nil || len(c.requests) == 0 {
		return handler, err
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if conversion, ok := c.requests[r.Method]; ok {
			if err := convertV1beta2RequestBody(r, conversion); err != nil {
				responder.Error(err)
				return
			}
		}
		handler.ServeHTTP(w, r)
	}), nil
}

func convertV1beta2RequestBody(r *http.Request, conversion v1beta2RequestConversion) error {
	if r.Body == nil {
		return nil
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, conversion.MaxBytes+1))
	if err != nil {
		return apierrors.NewBadRequest(fmt.Sprintf("read request body: %v", err))
	}
	if int64(len(body)) > conversion.MaxBytes {
		return apierrors.NewRequestEntityTooLargeError(fmt.Sprintf("request body exceeds %d bytes", conversion.MaxBytes))
	}
	if len(body) > 0 {
		if body, err = conversion.Convert(body); err != nil {
			return apierrors.NewBadRequest(fmt.Sprintf("invalid %s request body: %v", v1beta2.GroupVersion, err))
		}
	}
	r.Body = io.NopCloser(bytes.NewReader(body))
	r.ContentLength = int64(len(body))
	return nil
}

// v1beta2ObjectRequest converts a JSON body holding the v1beta2 object newObj returns into its
// storage version.
func v1beta2ObjectRequest(scheme *runtime.Scheme, newObj func() runtime.Object) func([]byte) ([]byte, error) {
	return func(body []byte) ([]byte, error) {
		obj := newObj()
		if err := json.Unmarshal(body, obj); err != nil {
			return nil, err
		}
		out, err := toStorageVersion(scheme, obj)
		if err != nil {
			return nil, err
		}
		return json.Marshal(out)
	}
}

// v1beta2Responder converts the objects a v0alpha1 connector responds with to v1beta2.
type v1beta2Responder struct {
	scheme *runtime.Scheme
	inner  rest.Responder
}

func (r *v1beta2Responder) Object(statusCode int, obj runtime.Object) {
	out, err := convertToV1beta2(r.scheme, obj)
	if err != nil {
		r.inner.Error(apierrors.NewInternalError(err))
		return
	}
	r.inner.Object(statusCode, out)
}

func (r *v1beta2Responder) Error(err error) {
	r.inner.Error(err)
}

var (
	_ rest.Storage         = (*v1beta2Connector)(nil)
	_ rest.Connecter       = (*v1beta2Connector)(nil)
	_ rest.StorageMetadata = (*v1beta2Connector)(nil)
	_ rest.Responder       = (*v1beta2Responder)(nil)
)
