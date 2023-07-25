/*
Copyright 2014 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

package admission

import (
	"context"
	"fmt"
	"io"

	"github.com/grafana/grafana-plugin-sdk-go/backend"

	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/plugins"
)

const PluginNameGrpcCalloutPluginValidate = "GrpcCalloutPluginValidate"

var (
	_ backend.CallResourceResponseSender = &grpcCalloutPluginValidate{}
)

// Register registers a plugin
func RegisterGrpcCalloutPluginValidate(plugins *admission.Plugins, pluginsClient plugins.Client) {
	plugins.Register(PluginNameGrpcCalloutPluginValidate, func(config io.Reader) (admission.Interface, error) {
		return NewGrpcCalloutPluginValidate(pluginsClient), nil
	})
}

// example of admission plugin that will deny any resource with name "deny"
type grpcCalloutPluginValidate struct {
	pluginsClient plugins.Client
}

var _ admission.ValidationInterface = grpcCalloutPluginValidate{}

func (g grpcCalloutPluginValidate) Send(response *backend.CallResourceResponse) error {
	fmt.Printf("Backend response is: +%v", response)
	return nil
}

// Validate makes an admission decision based on the request attributes.  It is NOT allowed to mutate.
func (g grpcCalloutPluginValidate) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	// kind := a.GetKind()
	if true { // kind.Group == "charandas.example.com" && kind.Kind == "TestObject"
		return g.pluginsClient.CallResource(ctx, &backend.CallResourceRequest{
			Path:   "/k8s/admission/mutation",
			Method: "GET",
			PluginContext: backend.PluginContext{
				OrgID:                      0,
				PluginID:                   "charandas-callbackadmissionexample-app",
				User:                       &backend.User{},
				AppInstanceSettings:        &backend.AppInstanceSettings{},
				DataSourceInstanceSettings: nil,
			},
			Body: []byte("{\"kind\":\"TestObject\",\"apiVersion\":\"charandas.example.com/v1\",\\}}"),
		}, g)
	}

	return nil
}

// Handles returns true if this admission controller can handle the given operation
// where operation can be one of CREATE, UPDATE, DELETE, or CONNECT
func (grpcCalloutPluginValidate) Handles(operation admission.Operation) bool {
	return true
}

// NewGrpcCalloutPluginValidate creates an always deny admission handler
func NewGrpcCalloutPluginValidate(pluginsClient plugins.Client) admission.Interface {
	return &grpcCalloutPluginValidate{
		pluginsClient: pluginsClient,
	}
}
