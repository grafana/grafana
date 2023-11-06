package clientmiddleware

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

const (
	statusOK        = "ok"
	statusError     = "error"
	statusCancelled = "cancelled"

	endpointCallResource    = "callResource"
	endpointCheckHealth     = "checkHealth"
	endpointCollectMetrics  = "collectMetrics"
	endpointQueryData       = "queryData"
	endpointSubscribeStream = "subscribeStream"
	endpointPublishStream   = "publishStream"
	endpointRunStream       = "runStream"
)

type callResourceResponseSenderFunc func(res *backend.CallResourceResponse) error

func (fn callResourceResponseSenderFunc) Send(res *backend.CallResourceResponse) error {
	return fn(res)
}
