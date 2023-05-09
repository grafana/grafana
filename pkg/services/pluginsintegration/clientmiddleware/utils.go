package clientmiddleware

import (
	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

type callResourceResponseSenderFunc func(res *backend.CallResourceResponse) error

func (fn callResourceResponseSenderFunc) Send(res *backend.CallResourceResponse) error {
	return fn(res)
}
