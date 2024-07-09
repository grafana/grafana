package clientmiddleware

import "github.com/grafana/grafana-plugin-sdk-go/backend"

var nopCallResourceSender = backend.CallResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
	return nil
})
