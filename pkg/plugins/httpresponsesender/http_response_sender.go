package httpresponsesender

import (
	"errors"
	"fmt"
	"net/http"
	"net/textproto"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

// HTTPResponseSender implements backend.CallResourceResponseSender and
// writes an HTTP response using an http.ResponseWriter given received
// backend.CallResourceResponse(s).
type HTTPResponseSender struct {
	processedStreams int
	w                http.ResponseWriter
}

// New creates a new HTTPResponseSender.
func New(w http.ResponseWriter) *HTTPResponseSender {
	if w == nil {
		panic("response writer cannot be nil")
	}

	return &HTTPResponseSender{
		w: w,
	}
}

func (s *HTTPResponseSender) Send(resp *backend.CallResourceResponse) error {
	if resp == nil {
		return errors.New("resp cannot be nil")
	}

	// Expected that headers and status are only part of first stream
	if s.processedStreams == 0 {
		for k, values := range resp.Headers {
			// Convert the keys to the canonical format of MIME headers.
			// This ensures that we can safely add/overwrite headers
			// even if the plugin returns them in non-canonical format
			// and be sure they won't be present multiple times in the response.
			k = textproto.CanonicalMIMEHeaderKey(k)

			for _, v := range values {
				s.w.Header().Add(k, v)
			}
		}

		s.w.WriteHeader(resp.Status)
	}

	if _, err := s.w.Write(resp.Body); err != nil {
		return fmt.Errorf("failed to write resource response: %v", err)
	}

	if flusher, ok := s.w.(http.Flusher); ok {
		flusher.Flush()
	}

	s.processedStreams++
	return nil
}

var _ backend.CallResourceResponseSender = &HTTPResponseSender{}
