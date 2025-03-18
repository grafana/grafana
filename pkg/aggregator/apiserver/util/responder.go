package util

import (
	"net/http"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/handlers/responsewriters"
	"k8s.io/component-base/tracing"
)

// Responder implements rest.Responder for assisting a connector in writing objects or errors.
type Responder struct {
	ResponseWriter http.ResponseWriter
}

func (r Responder) Object(statusCode int, obj runtime.Object) {
	responsewriters.WriteRawJSON(statusCode, obj, r.ResponseWriter)
}

func (r *Responder) Error(_ http.ResponseWriter, req *http.Request, err error) {
	tracing.SpanFromContext(req.Context()).RecordError(err)
	s := responsewriters.ErrorToAPIStatus(err)
	r.Object(http.StatusInternalServerError, s)
}
