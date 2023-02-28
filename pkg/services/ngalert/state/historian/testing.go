package historian

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"net/http"

	"github.com/grafana/grafana/pkg/services/annotations"
)

type fakeRequester struct {
	lastRequest *http.Request
	resp        *http.Response
}

func NewFakeRequester() *fakeRequester {
	return &fakeRequester{
		resp: &http.Response{
			Status:        "200 OK",
			StatusCode:    200,
			Body:          io.NopCloser(bytes.NewBufferString("")),
			ContentLength: int64(0),
			Header:        make(http.Header, 0),
		},
	}
}

func (f *fakeRequester) WithResponse(resp *http.Response) *fakeRequester {
	f.resp = resp
	return f
}

func (f *fakeRequester) Do(req *http.Request) (*http.Response, error) {
	f.lastRequest = req
	f.resp.Request = req // Not concurrency-safe!
	return f.resp, nil
}

type failingAnnotationRepo struct{}

func (f *failingAnnotationRepo) SaveMany(_ context.Context, _ []annotations.Item) error {
	return fmt.Errorf("failed to save annotations")
}

func (f *failingAnnotationRepo) Find(_ context.Context, _ *annotations.ItemQuery) ([]*annotations.ItemDTO, error) {
	return nil, fmt.Errorf("failed to query annotations")
}
