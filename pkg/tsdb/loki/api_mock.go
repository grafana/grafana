package loki

import (
	"bytes"
	"io"
	"net/http"

	"github.com/grafana/grafana/pkg/infra/log"
)

type mockRequestCallback func(req *http.Request)

type mockedRoundTripper struct {
	statusCode      int
	responseBytes   []byte
	contentType     string
	requestCallback mockRequestCallback
}

func (mockedRT *mockedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	requestCallback := mockedRT.requestCallback
	if requestCallback != nil {
		requestCallback(req)
	}

	header := http.Header{}
	header.Add("Content-Type", mockedRT.contentType)
	return &http.Response{
		StatusCode: mockedRT.statusCode,
		Header:     header,
		Body:       io.NopCloser(bytes.NewReader(mockedRT.responseBytes)),
	}, nil
}

type mockedCompressedRoundTripper struct {
	statusCode      int
	responseBytes   []byte
	contentType     string
	requestCallback mockRequestCallback
}

func (mockedRT *mockedCompressedRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	requestCallback := mockedRT.requestCallback
	if requestCallback != nil {
		requestCallback(req)
	}

	header := http.Header{}
	header.Add("Content-Type", mockedRT.contentType)
	header.Add("Content-Encoding", "gzip")
	return &http.Response{
		StatusCode: mockedRT.statusCode,
		Header:     header,
		Body:       io.NopCloser(bytes.NewReader(mockedRT.responseBytes)),
	}, nil
}

func makeMockedAPI(statusCode int, contentType string, responseBytes []byte, requestCallback mockRequestCallback) *LokiAPI {
	return makeMockedAPIWithUrl("http://localhost:9999", statusCode, contentType, responseBytes, requestCallback)
}

func makeMockedAPIWithUrl(url string, statusCode int, contentType string, responseBytes []byte, requestCallback mockRequestCallback) *LokiAPI {
	client := http.Client{
		Transport: &mockedRoundTripper{statusCode: statusCode, contentType: contentType, responseBytes: responseBytes, requestCallback: requestCallback},
	}

	return newLokiAPI(&client, url, log.New("test"))
}

func makeCompressedMockedAPIWithUrl(url string, statusCode int, contentType string, responseBytes []byte, requestCallback mockRequestCallback) *LokiAPI {
	client := http.Client{
		Transport: &mockedCompressedRoundTripper{statusCode: statusCode, contentType: contentType, responseBytes: responseBytes, requestCallback: requestCallback},
	}

	return newLokiAPI(&client, url, log.New("test"))
}
