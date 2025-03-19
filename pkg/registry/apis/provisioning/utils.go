package provisioning

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	// contentTypeJSON is the Content-Type for JSON requests as go standard library does not provide one
	contentTypeJSON = "application/json"
	// defaultMaxBodySize is the default max size for request bodies (10KB)
	defaultMaxBodySize = 10 * 1024
	// errMsgRequestTooLarge is the error message for request bodies that are too large
	errMsgRequestTooLarge = "request body too large"
)

// readBody reads the request body and limits the size
func readBody(r *http.Request, maxSize int64) ([]byte, error) {
	limitedBody := http.MaxBytesReader(nil, r.Body, maxSize)
	body, err := io.ReadAll(limitedBody)
	if err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			return nil, fmt.Errorf("%s: max size %d bytes", errMsgRequestTooLarge, maxSize)
		}
		return nil, fmt.Errorf("error reading request body: %w", err)
	}
	return body, nil
}

// isJSONContentType checks if the request has the JSON Content-Type
func isJSONContentType(r *http.Request) bool {
	contentType := r.Header.Get("Content-Type")
	return strings.HasPrefix(contentType, contentTypeJSON)
}

// withTimeout adds a timeout context to the request
func withTimeout(h http.Handler, timeout time.Duration) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), timeout)
		defer cancel()
		h.ServeHTTP(w, r.WithContext(ctx))
	})
}

// withTimeoutFunc adds a timeout context to the request
func withTimeoutFunc(f func(w http.ResponseWriter, r *http.Request), timeout time.Duration) func(w http.ResponseWriter, r *http.Request) {
	return withTimeout(http.HandlerFunc(f), timeout).ServeHTTP
}

// unmarshalJSON creates a size-limited JSON decoder
func unmarshalJSON(r *http.Request, maxSize int64, v interface{}) error {
	if !isJSONContentType(r) {
		return fmt.Errorf("content type is not JSON: %s", r.Header.Get("Content-Type"))
	}

	r.Body = http.MaxBytesReader(nil, r.Body, maxSize)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()

	if err := decoder.Decode(v); err != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			return fmt.Errorf("%s: max size %d bytes", errMsgRequestTooLarge, maxSize)
		}
		if err == io.EOF {
			return fmt.Errorf("empty request body")
		}
		return fmt.Errorf("error decoding JSON: %w", err)
	}

	if decoder.More() {
		return fmt.Errorf("multiple JSON objects not allowed")
	}

	return nil
}
