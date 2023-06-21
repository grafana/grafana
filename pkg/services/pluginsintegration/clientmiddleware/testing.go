package clientmiddleware

import "github.com/grafana/grafana-plugin-sdk-go/backend"

var nopCallResourceSender = callResourceResponseSenderFunc(func(res *backend.CallResourceResponse) error {
	return nil
})
