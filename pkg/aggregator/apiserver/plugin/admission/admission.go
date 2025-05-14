package admission

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	admissionv1 "k8s.io/api/admission/v1"
	"k8s.io/apimachinery/pkg/runtime/serializer"
)

func ToAdmissionRequest(pluginCtx backend.PluginContext, a *admissionv1.AdmissionReview) (*backend.AdmissionRequest, error) {
	if a.Request == nil {
		return nil, errors.New("admission review request is nil")
	}
	op, err := ToAdmissionOperation(a.Request.Operation)
	if err != nil {
		return nil, err
	}

	return &backend.AdmissionRequest{
		PluginContext: pluginCtx,
		Operation:     op,
		Kind: backend.GroupVersionKind{
			Group:   a.Request.Kind.Group,
			Version: a.Request.Kind.Version,
			Kind:    a.Request.Kind.Kind,
		},
		ObjectBytes:    a.Request.Object.Raw,
		OldObjectBytes: a.Request.OldObject.Raw,
	}, nil
}

func ToAdmissionOperation(o admissionv1.Operation) (backend.AdmissionRequestOperation, error) {
	switch o {
	case admissionv1.Create:
		return backend.AdmissionRequestCreate, nil
	case admissionv1.Delete:
		return backend.AdmissionRequestDelete, nil
	case admissionv1.Update:
		return backend.AdmissionRequestUpdate, nil
	case admissionv1.Connect:
		// TODO: CONNECT is missing from the plugin SDK
		return 3, nil
	}
	return 0, errors.New("unknown admission review operation")
}

func ParseRequest(codecs serializer.CodecFactory, r *http.Request) (*admissionv1.AdmissionReview, error) {
	var body []byte
	if r.Body != nil {
		if data, err := io.ReadAll(r.Body); err == nil {
			body = data
		}
	}

	contentType := r.Header.Get("Content-Type")
	if contentType != "application/json" {
		return nil, fmt.Errorf("contentType=%s, expect application/json", contentType)
	}

	deserializer := codecs.UniversalDeserializer()
	obj, gvk, err := deserializer.Decode(body, nil, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to decode request: %v", err)
	}

	ar, ok := obj.(*admissionv1.AdmissionReview)
	if !ok {
		return nil, fmt.Errorf("expected AdmissionReview v1, got %T", obj)
	}

	ar.SetGroupVersionKind(*gvk)

	return ar, nil
}
