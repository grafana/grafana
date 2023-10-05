package elasticsearch

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func createPluginErrorResponse(refId string, err error) *backend.QueryDataResponse {
	queryDataRes := &backend.QueryDataResponse{}
	queryDataRes.Responses[refId] = backend.DataResponse{
		Error:       err,
		ErrorSource: backend.ErrorSourcePlugin,
	}
	return queryDataRes
}

func createDownstreamErrorResponse(refId string, err error) *backend.QueryDataResponse {
	queryDataRes := &backend.QueryDataResponse{}
	queryDataRes.Responses[refId] = backend.DataResponse{
		Error:       err,
		ErrorSource: backend.ErrorSourceDownstream,
	}
	return queryDataRes
}
