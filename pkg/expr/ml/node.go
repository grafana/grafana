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

const (
	Outlier CommandType = "outlier"

	// format of the time used by outlier API
	timeFormat = "2006-01-02T15:04:05.999999999"

	defaultInterval = 1000 * time.Millisecond
)

type Command interface {
	DatasourceUID() string
	Execute(from, to time.Time, sendRequest func(method string, path string, payload []byte) (response.Response, error)) (*backend.QueryDataResponse, error)
}

type CommandType string

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
