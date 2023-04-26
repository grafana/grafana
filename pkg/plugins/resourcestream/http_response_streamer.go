package resourcestream

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/textproto"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/plugins"
)

// HTTPResponseStreamer provides a wrapper/utility function for calling a plugin
// resource and writing its response to HTTP response using an http.ResponseWriter.
type HTTPResponseStreamer struct {
	log    log.Logger
	client plugins.Client
	w      http.ResponseWriter
}

// NewHTTPResponseStreamer creates a new HTTPResponseStreamer.
func NewHTTPResponseStreamer(logger log.Logger, client plugins.Client, w http.ResponseWriter) (*HTTPResponseStreamer, error) {
	if logger == nil {
		return nil, errors.New("logger cannot be nil")
	}

	if client == nil {
		return nil, errors.New("client cannot be nil")
	}

	if w == nil {
		return nil, errors.New("w cannot be nil")
	}

	return &HTTPResponseStreamer{
		client: client,
		w:      w,
	}, nil
}

// CallResource calls plugin client CallResource using the underlying plugin
// client given request req and writing call resource responses using the
// underlying http.ResponseWriter.
func (s HTTPResponseStreamer) CallResource(ctx context.Context, req *backend.CallResourceRequest) error {
	childCtx, cancel := context.WithCancel(ctx)
	defer cancel()
	stream := newCallResourceResponseStream(childCtx)

	var wg sync.WaitGroup
	wg.Add(1)

	defer func() {
		if err := stream.Close(); err != nil {
			s.log.Warn("Failed to close plugin resource stream", "err", err)
		}
		wg.Wait()
	}()

	var flushStreamErr error
	go func() {
		flushStreamErr = s.flushStream(stream)
		wg.Done()
	}()

	if err := s.client.CallResource(ctx, req, stream); err != nil {
		return err
	}

	return flushStreamErr
}

func (s *HTTPResponseStreamer) flushStream(stream callResourceClientResponseStream) error {
	processedStreams := 0
	for {
		resp, err := stream.Recv()
		if errors.Is(err, io.EOF) {
			if processedStreams == 0 {
				return errors.New("received empty resource response")
			}
			return nil
		}
		if err != nil {
			if processedStreams == 0 {
				return fmt.Errorf("%v: %w", "failed to receive response from resource call", err)
			}

			s.log.Error("Failed to receive response from resource call", "err", err)
			return stream.Close()
		}

		// Expected that headers and status are only part of first stream
		if processedStreams == 0 {
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
			s.log.Error("Failed to write resource response", "err", err)
		}

		if flusher, ok := s.w.(http.Flusher); ok {
			flusher.Flush()
		}
		processedStreams++
	}
}

// callResourceClientResponseStream is used for receiving resource call responses.
type callResourceClientResponseStream interface {
	Recv() (*backend.CallResourceResponse, error)
	Close() error
}

type callResourceResponseStream struct {
	ctx    context.Context
	stream chan *backend.CallResourceResponse
	closed bool
}

func newCallResourceResponseStream(ctx context.Context) *callResourceResponseStream {
	return &callResourceResponseStream{
		ctx:    ctx,
		stream: make(chan *backend.CallResourceResponse),
	}
}

func (s *callResourceResponseStream) Send(res *backend.CallResourceResponse) error {
	if s.closed {
		return errors.New("cannot send to a closed stream")
	}

	select {
	case <-s.ctx.Done():
		return errors.New("cancelled")
	case s.stream <- res:
		return nil
	}
}

func (s *callResourceResponseStream) Recv() (*backend.CallResourceResponse, error) {
	select {
	case <-s.ctx.Done():
		return nil, s.ctx.Err()
	case res, ok := <-s.stream:
		if !ok {
			return nil, io.EOF
		}
		return res, nil
	}
}

func (s *callResourceResponseStream) Close() error {
	if s.closed {
		return errors.New("cannot close a closed stream")
	}

	close(s.stream)
	s.closed = true
	return nil
}

type HTTPResponseSender struct {
	processedStreams int
	w                http.ResponseWriter
}

func NewHTTPResponseSender(w http.ResponseWriter) *HTTPResponseSender {
	return &HTTPResponseSender{
		w: w,
	}
}

func (s *HTTPResponseSender) Send(resp *backend.CallResourceResponse) error {
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
