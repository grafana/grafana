// Package responsesize records the size of each query's plugin response in a Recorder carried in
// the request context. Experimental: the API may change or be removed without notice.
package responsesize

import (
	"context"
	"maps"
	"sync"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
)

type contextKey struct{}

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
