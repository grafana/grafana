package tsdb

import (
	"context"
	"fmt"

	"github.com/grafana/grafana/pkg/models"
)

type HandleRequestFunc func(ctx context.Context, dsInfo *models.DataSource, req *TsdbQuery) (*Response, error)

func HandleRequest(ctx context.Context, dsInfo *models.DataSource, req *TsdbQuery) (*Response, error) {
	endpoint, err := getTsdbQueryEndpointFor(dsInfo)
	if err != nil {
		return nil, err
	}

	return endpoint.Query(ctx, dsInfo, req)
}

func HandleWebSocketRequest(ctx context.Context, dsInfo *models.DataSource, req *TsdbQuery) (chan *QueryResult, error) {
	endpoint, err := getTsdbQueryEndpointFor(dsInfo)
	if err != nil {
		return nil, err
	}

	if websocketEndpoint, ok := endpoint.(TsdbWebSocketQueryEndpoint); ok {
		channel := make(chan *QueryResult)
		go websocketEndpoint.WebSocketQuery(ctx, dsInfo, req, channel)
		return channel, nil
	} else {
		return nil, fmt.Errorf("WebSocketQuery not implemented")
	}
}
