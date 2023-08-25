package client

import "github.com/grafana/grafana-plugin-sdk-go/backend"

type CallResourceResponseSenderFunc func(res *backend.CallResourceResponse) error

func (fn CallResourceResponseSenderFunc) Send(res *backend.CallResourceResponse) error {
	return fn(res)
}
