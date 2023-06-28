package ml

import (
	"fmt"
	"strings"
	"time"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	jsoniter "github.com/json-iterator/go"

	"github.com/grafana/grafana/pkg/api/response"
)

var json = jsoniter.ConfigCompatibleWithStandardLibrary

type CommandType string

const (
	Outlier CommandType = "outlier"

	// format of the time used by outlier API
	timeFormat = "2006-01-02T15:04:05.999999999"

	defaultInterval = 1000 * time.Millisecond
)

// Command is an interface implemented by all Machine Learning commands that can be executed against ML API.
type Command interface {
	// DatasourceUID returns UID of a data source that is used by machine learning as the source of data
	DatasourceUID() string
	// Execute creates a payload send request to the ML API by calling the function argument sendRequest, and then parses response.
	// Function sendRequest is supposed to abstract the client configuration such creating http request, adding authorization parameters, host etc.
	Execute(from, to time.Time, sendRequest func(method string, path string, payload []byte) (response.Response, error)) (*backend.QueryDataResponse, error)
}

// UnmarshalCommand parses a query parameters and creates a command. Requires key `type` to be specified.
// It does not perform payload validation and only extracts required field. Returns Command that is ready to be executed.
func UnmarshalCommand(query map[string]interface{}, appURL string) (Command, error) {
	q := jsoniter.Wrap(query)
	typeNode := q.Get("type")
	if typeNode.ValueType() != jsoniter.StringValue {
		return nil, fmt.Errorf("field 'type' is required and should be string")
	}

	switch mlType := strings.ToLower(typeNode.ToString()); mlType {
	case string(Outlier):
		return unmarshalOutlierCommand(q, appURL)
	default:
		return nil, fmt.Errorf("unsupported command type '%v'. Supported only '%s'", mlType, Outlier)
	}
}
