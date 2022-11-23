package models

import (
	"context"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type cloudWatchLink struct {
	View    string        `json:"view"`
	Stacked bool          `json:"stacked"`
	Title   string        `json:"title"`
	Start   string        `json:"start"`
	End     string        `json:"end"`
	Region  string        `json:"region"`
	Metrics []interface{} `json:"metrics"`
}

type metricExpression struct {
	Expression string `json:"expression"`
	Label      string `json:"label,omitempty"`
}

type metricStatMeta struct {
	Stat      string `json:"stat"`
	Period    int    `json:"period"`
	Label     string `json:"label,omitempty"`
	AccountId string `json:"accountId,omitempty"`
}

type BaseQuery struct {
	QueryType string `json:"type,omitempty"`
	Region    string `json:"region,omitempty"`
	QueryMode string
}

type QueryHandlerFunc func(context.Context, *backend.QueryDataRequest, backend.DataQuery, RequestContextFactoryFunc) backend.DataResponse
