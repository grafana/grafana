package lokiclient

import (
	"bytes"
	"io"
	"net/http"
)

type fakeRequester struct {
	LastRequest *http.Request
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
	f.LastRequest = req
	f.resp.Request = req // Not concurrency-safe!
	return f.resp, nil
}
