package backendplugin

import (
	"context"
	"errors"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func newCallResourceResponseStream(ctx context.Context) *callResourceResponseStream {
	return &callResourceResponseStream{
		ctx:    ctx,
		stream: make(chan *backend.CallResourceResponse),
	}
}

type callResourceResponseStream struct {
	ctx    context.Context
	stream chan *backend.CallResourceResponse
	closed bool
}

func (s *callResourceResponseStream) Send(res *backend.CallResourceResponse) error {
	if s.closed {
		return errors.New("Cannot send to a closed stream")
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
		return errors.New("Cannot close a closed stream")
	}

	close(s.stream)
	s.closed = true
	return nil
}
