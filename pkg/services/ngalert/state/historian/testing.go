package historian

import (
	"bytes"
	"io/ioutil"
	"net/http"
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
			Body:          ioutil.NopCloser(bytes.NewBufferString("")),
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
