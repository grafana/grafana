package ml

import (
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"github.com/grafana/grafana/pkg/api/response"
)

type FakeCommand struct {
	Method     string
	Path       string
	Payload    []byte
	Response   *backend.QueryDataResponse
	Error      error
	Recordings []struct {
		From     time.Time
		To       time.Time
		Response response.Response
		Error    error
	}
}

var _ Command = &FakeCommand{}

func (f *FakeCommand) DatasourceUID() string {
	return "fake-ml-datasource"
}

func (f *FakeCommand) Execute(from, to time.Time, executor func(method string, path string, payload []byte) (response.Response, error)) (*backend.QueryDataResponse, error) {
	r, err := executor(f.Method, f.Path, f.Payload)
	f.Recordings = append(f.Recordings, struct {
		From     time.Time
		To       time.Time
		Response response.Response
		Error    error
	}{From: from, To: to, Response: r, Error: err})

	if err != nil {
		return nil, err
	}
	return f.Response, f.Error
}
