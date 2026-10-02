package datasource

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	dsV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type httpResponder interface {
	Object(int, any)
	Error(error)
}

type jsonResponder struct {
	w     http.ResponseWriter
	r     *http.Request
	group string
}

func (s jsonResponder) Object(code int, obj any) {
	meta := func(kind string) metav1.TypeMeta {
		return metav1.TypeMeta{Kind: kind, APIVersion: s.group + "/v0alpha1"}
	}
	// Copy only the envelope: cached metadata and SDK frames must not be mutated or deep-copied.
	switch value := obj.(type) {
	case *dsV0.QueryDataResponse:
		v := *value
		v.TypeMeta = meta("QueryDataResponse")
		obj = &v
	case *dsV0.QueryDataRequest:
		v := *value
		v.TypeMeta = meta("QueryDataRequest")
		obj = &v
	case *dsV0.HealthCheckResult:
		v := *value
		v.TypeMeta = meta("HealthCheckResult")
		obj = &v
	case *dsV0.DataSource:
		v := *value
		v.TypeMeta = meta("DataSource")
		obj = &v
	case *dsV0.DataSourceList:
		v := *value
		v.TypeMeta = meta("DataSourceList")
		obj = &v
	}
	WriteHTTPJSON(s.w, code, obj)
}

func (s jsonResponder) Error(err error) { WriteHTTPError(s.w, s.r, err) }

// WriteHTTPError preserves the JSON Status envelope consumed by existing datasource clients.
func WriteHTTPError(w http.ResponseWriter, r *http.Request, err error) {
	if written, ok := w.(interface{ Written() bool }); ok && written.Written() {
		panic(http.ErrAbortHandler)
	}
	var tooLarge *http.MaxBytesError
	switch {
	case errors.As(err, &tooLarge):
		err = apierrors.NewRequestEntityTooLargeError("request exceeds body limit")
	case errors.Is(err, context.DeadlineExceeded), errors.Is(r.Context().Err(), context.DeadlineExceeded):
		err = apierrors.NewTimeoutError("datasource request timed out", 0)
	}
	status := metav1.Status{Status: metav1.StatusFailure, Code: 500, Reason: metav1.StatusReasonUnknown, Message: err.Error()}
	if apiStatus, ok := err.(apierrors.APIStatus); ok {
		status = apiStatus.Status()
		if status.Status == "" {
			status.Status = metav1.StatusFailure
		}
		if status.Code == 0 {
			status.Code = 500
			if status.Status == metav1.StatusSuccess {
				status.Code = 200
			}
		}
	}
	version := "v1"
	// Existing datasource endpoints encode Status in the requested group's version.
	if path := strings.SplitN(r.URL.Path, "/", 5); len(path) >= 4 && path[1] == "apis" {
		version = path[2] + "/" + path[3]
	}
	status.TypeMeta = metav1.TypeMeta{Kind: "Status", APIVersion: version}
	if status.Details != nil && status.Details.RetryAfterSeconds > 0 {
		w.Header().Set("Retry-After", strconv.Itoa(int(status.Details.RetryAfterSeconds)))
	}
	WriteHTTPJSON(w, int(status.Code), &status)
}

func WriteHTTPJSON(w http.ResponseWriter, code int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	// Encode directly to avoid an extra full-response copy from json.Marshal.
	if err := json.NewEncoder(w).Encode(value); err != nil {
		panic(http.ErrAbortHandler)
	}
}
