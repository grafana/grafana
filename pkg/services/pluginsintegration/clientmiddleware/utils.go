package clientmiddleware

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type requestStatus int

const (
	requestStatusOK requestStatus = iota
	requestStatusError
	requestStatusCancelled
)

func (status requestStatus) String() string {
	names := [...]string{"ok", "error", "cancelled"}
	if status < requestStatusOK || status > requestStatusCancelled {
		return ""
	}

	return names[status]
}

const (
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

func requestStatusFromError(err error) (requestStatus, error) {
	status := requestStatusOK
	if err != nil {
		status = requestStatusError
		if errors.Is(err, context.Canceled) {
			status = requestStatusCancelled
		}
	}

	return status, err
}

func requestStatusFromQueryDataResponse(res *backend.QueryDataResponse, err error) (requestStatus, error) {
	if err != nil {
		return requestStatusFromError(err)
	}

	status := requestStatusOK

	if res != nil {
		for _, dr := range res.Responses {
			if dr.Error != nil {
				s, _ := requestStatusFromError(dr.Error)
				if s > status {
					status = s
				}
			}
		}
	}

	return status, err
}
