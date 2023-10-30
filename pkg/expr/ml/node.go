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

// UnmarshalCommand parses a config parameters and creates a command. Requires key `type` to be specified.
// Based on the value of `type` field it parses a Command
func UnmarshalCommand(query []byte, appURL string) (Command, error) {
	var expr CommandConfiguration
	err := json.Unmarshal(query, &expr)
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal Machine learning command: %w", err)
	}
	if len(expr.Type) == 0 {
		return nil, fmt.Errorf("required field 'type' is not specified or empty.  Should be one of [%s]", Outlier)
	}

	if len(expr.Config) == 0 {
		return nil, fmt.Errorf("required field 'config' is not specified")
	}

	var cmd Command
	switch mlType := strings.ToLower(expr.Type); mlType {
	case string(Outlier):
		cmd, err = unmarshalOutlierCommand(expr, appURL)
	default:
		return nil, fmt.Errorf("unsupported command type. Should be one of [%s]", Outlier)
	}
	if err != nil {
		return nil, fmt.Errorf("failed to unmarshal Machine learning %s command: %w", expr.Type, err)
	}
	return cmd, nil
}
