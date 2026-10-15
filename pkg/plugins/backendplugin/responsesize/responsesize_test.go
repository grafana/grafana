package responsesize

import (
	"context"
	"errors"
	"io"
	"sync"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/genproto/pluginv2"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
)

func TestRecorderAddsUpSizesPerRefID(t *testing.T) {
	_, r := WithRecorder(context.Background())

	r.Add("A", 10)
	r.Add("B", 5)
	r.Add("A", 7)

	assert.Equal(t, map[string]int64{"A": 17, "B": 5}, r.Sizes())
}

func TestSizesReturnsACopy(t *testing.T) {
	_, r := WithRecorder(context.Background())
	r.Add("A", 1)

	r.Sizes()["A"] = 999

	assert.Equal(t, map[string]int64{"A": 1}, r.Sizes())
}

func TestFromContext(t *testing.T) {
	assert.Nil(t, FromContext(context.Background()))

	ctx, r := WithRecorder(context.Background())
	require.Same(t, r, FromContext(ctx))
}

func TestNilRecorderIgnoresEverything(t *testing.T) {
	var r *Recorder

	r.Add("A", 1)

	assert.Nil(t, r.Sizes())
}

func TestRecorderIsSafeForConcurrentUse(t *testing.T) {
	_, r := WithRecorder(context.Background())

	var wg sync.WaitGroup
	for range 50 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			r.Add("A", 2)
			_ = r.Sizes()
		}()
	}
	wg.Wait()

	assert.Equal(t, map[string]int64{"A": 100}, r.Sizes())
}

type fakeStream struct {
	grpc.ClientStream
	chunks []*pluginv2.QueryChunkedDataResponse
	err    error
}

func (s *fakeStream) Recv() (*pluginv2.QueryChunkedDataResponse, error) {
	if len(s.chunks) == 0 {
		if s.err != nil {
			return nil, s.err
		}
		return nil, io.EOF
	}
	c := s.chunks[0]
	s.chunks = s.chunks[1:]
	return c, nil
}

func TestWrapChunkedStreamRecordsChunksAsTheyAreRead(t *testing.T) {
	a, b := &pluginv2.QueryChunkedDataResponse{RefId: "A", Frame: make([]byte, 10)}, &pluginv2.QueryChunkedDataResponse{RefId: "B", Frame: make([]byte, 4)}
	_, r := WithRecorder(context.Background())
	stream := r.WrapChunkedStream(&fakeStream{chunks: []*pluginv2.QueryChunkedDataResponse{a, b, a}})

	got, err := stream.Recv()
	require.NoError(t, err)
	assert.Same(t, a, got, "chunks pass through untouched")
	assert.Equal(t, map[string]int64{"A": 10}, r.Sizes(), "nothing is counted before it is read")

	_, _ = stream.Recv()
	_, _ = stream.Recv()
	_, err = stream.Recv()

	assert.ErrorIs(t, err, io.EOF)
	assert.Equal(t, map[string]int64{"A": 20, "B": 4}, r.Sizes())
}

func TestWrapChunkedStreamDoesNotRecordAFailedRead(t *testing.T) {
	_, r := WithRecorder(context.Background())
	stream := r.WrapChunkedStream(&fakeStream{err: errors.New("boom")})

	_, err := stream.Recv()

	require.EqualError(t, err, "boom")
	assert.Empty(t, r.Sizes())
}

func TestWrapChunkedStreamWithoutARecorderReturnsTheStreamAsIs(t *testing.T) {
	var r *Recorder
	stream := &fakeStream{}

	assert.Same(t, stream, r.WrapChunkedStream(stream))
	assert.Nil(t, r.WrapChunkedStream(nil))
}

func TestAddQueryDataResponseIgnoresANilResponse(t *testing.T) {
	_, r := WithRecorder(context.Background())

	r.AddQueryDataResponse(nil)

	assert.Empty(t, r.Sizes())
}
