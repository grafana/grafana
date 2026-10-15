// Package responsesize records how many bytes each query of a plugin response took. A caller installs
// a Recorder in the request context and the plugin client fills it; without one nothing is measured.
//
// Experimental: the API may change or be removed without notice.
package responsesize

import (
	"context"
	"maps"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"google.golang.org/grpc"
)

type contextKey struct{}

// Recorder collects response sizes in bytes by refID. A nil *Recorder ignores everything.
type Recorder struct {
	mu    sync.Mutex
	sizes map[string]int64
}

func WithRecorder(ctx context.Context) (context.Context, *Recorder) {
	r := &Recorder{}
	return context.WithValue(ctx, contextKey{}, r), r
}

func FromContext(ctx context.Context) *Recorder {
	r, _ := ctx.Value(contextKey{}).(*Recorder)
	return r
}

// Add adds to the total for refID, so a retried query reports every byte received.
func (r *Recorder) Add(refID string, bytes int64) {
	if r == nil {
		return
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.sizes == nil {
		r.sizes = map[string]int64{}
	}
	r.sizes[refID] += bytes
}

func (r *Recorder) Sizes() map[string]int64 {
	if r == nil {
		return nil
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	return maps.Clone(r.sizes)
}

// AddQueryDataResponse adds each refID's encoded frame bytes. It reads the response as received, so
// nothing is re-encoded.
func (r *Recorder) AddQueryDataResponse(resp *pluginv2.QueryDataResponse) {
	if r == nil {
		return
	}
	for refID, dr := range resp.GetResponses() {
		var size int
		for _, frame := range dr.GetFrames() {
			size += len(frame)
		}
		r.Add(refID, int64(size))
	}
}

func (r *Recorder) AddChunk(chunk *pluginv2.QueryChunkedDataResponse) {
	if r == nil {
		return
	}
	r.Add(chunk.GetRefId(), int64(len(chunk.GetFrame())))
}

// WrapChunkedStream records each chunk's size as the caller reads it. Without a Recorder it returns
// the stream unchanged.
func (r *Recorder) WrapChunkedStream(stream grpc.ServerStreamingClient[pluginv2.QueryChunkedDataResponse]) grpc.ServerStreamingClient[pluginv2.QueryChunkedDataResponse] {
	if r == nil || stream == nil {
		return stream
	}
	return &recordingStream{ServerStreamingClient: stream, recorder: r}
}

type recordingStream struct {
	grpc.ServerStreamingClient[pluginv2.QueryChunkedDataResponse]
	recorder *Recorder
}

func (s *recordingStream) Recv() (*pluginv2.QueryChunkedDataResponse, error) {
	chunk, err := s.ServerStreamingClient.Recv()
	if err == nil {
		s.recorder.AddChunk(chunk)
	}
	return chunk, err
}
