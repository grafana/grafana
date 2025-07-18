package lokiclient

import (
	"bytes"
	"io"
	"net/http"
)

type FakeRequester struct {
	LastRequest *http.Request
	Resp        *http.Response
}

func NewFakeRequester() *FakeRequester {
	return &FakeRequester{
		Resp: &http.Response{
			Status:        "200 OK",
			StatusCode:    200,
			Body:          io.NopCloser(bytes.NewBufferString("")),
			ContentLength: int64(0),
			Header:        make(http.Header, 0),
		},
	}
}

func (f *FakeRequester) WithResponse(resp *http.Response) *FakeRequester {
	f.Resp = resp
	return f
}

func (f *FakeRequester) Do(req *http.Request) (*http.Response, error) {
	f.LastRequest = req
	f.Resp.Request = req // Not concurrency-safe!
	return f.Resp, nil
}

func BadResponse() *http.Response {
	return &http.Response{
		Status:        "400 Bad Request",
		StatusCode:    http.StatusBadRequest,
		Body:          io.NopCloser(bytes.NewBufferString("")),
		ContentLength: int64(0),
		Header:        make(http.Header, 0),
	}
}
