package clientmiddleware

import (
	"context"
	"errors"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type requestStatus int

const (
	requestStatusOK requestStatus = iota
	requestStatusCancelled
	requestStatusError
)

func (status requestStatus) String() string {
	names := [...]string{"ok", "cancelled", "error"}
	if status < requestStatusOK || status > requestStatusError {
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

func requestStatusFromError(err error) requestStatus {
	status := requestStatusOK
	if err != nil {
		status = requestStatusError
		if errors.Is(err, context.Canceled) {
			status = requestStatusCancelled
		}
	}

	return status
}

func requestStatusFromQueryDataResponse(res *backend.QueryDataResponse, err error) requestStatus {
	if err != nil {
		return requestStatusFromError(err)
	}

	status := requestStatusOK

	if res != nil {
		for _, dr := range res.Responses {
			if dr.Error != nil {
				s := requestStatusFromError(dr.Error)
				if s > status {
					status = s
				}

				if status == requestStatusError {
					break
				}
			}
		}
	}

	return status
}
