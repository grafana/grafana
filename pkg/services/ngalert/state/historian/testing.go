package historian

import (
	"bytes"
	"io/ioutil"
	"net/http"
)

type fakeRequester struct {
	lastRequest *http.Request
}

func NewFakeRequester() *fakeRequester {
	return &fakeRequester{}
}

func (f *fakeRequester) Do(req *http.Request) (*http.Response, error) {
	f.lastRequest = req
	return &http.Response{
		Status:        "200 OK",
		StatusCode:    200,
		Body:          ioutil.NopCloser(bytes.NewBufferString("")),
		ContentLength: int64(0),
		Request:       req,
		Header:        make(http.Header, 0),
	}, nil
}
