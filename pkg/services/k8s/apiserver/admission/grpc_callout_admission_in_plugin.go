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
	"encoding/json"
	"errors"
	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"io"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	admissionsV1 "k8s.io/api/admission/v1"
	authenticationV1 "k8s.io/api/authentication/v1"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana/pkg/plugins"
)

const PluginNameGrpcCalloutAdmissionInPlugin = "GrpcCalloutAdmissionInPlugin"

// Register registers a plugin
func RegisterGrpcCalloutAdmissionInPlugin(plugins *admission.Plugins, pluginsClient plugins.Client) {
	plugins.Register(PluginNameGrpcCalloutAdmissionInPlugin, func(config io.Reader) (admission.Interface, error) {
		return NewGrpcCalloutAdmissionInPlugin(pluginsClient), nil
	})
}

// example of admission plugin that will deny any resource with name "deny"
type grpcCalloutAdmissionInPlugin struct {
	pluginsClient plugins.Client
}

var _ admission.MutationInterface = grpcCalloutAdmissionInPlugin{}
var _ admission.ValidationInterface = grpcCalloutAdmissionInPlugin{}

// Admit makes an admission decision based on the request attributes.
func (g grpcCalloutAdmissionInPlugin) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	return g.proxyAdminOrValidate(ctx, a, o, true)
}

// Validate makes an admission decision based on the request attributes.  It is NOT allowed to mutate.
func (g grpcCalloutAdmissionInPlugin) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) error {
	return g.proxyAdminOrValidate(ctx, a, o, false)
}

func (g grpcCalloutAdmissionInPlugin) proxyAdminOrValidate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces, isMutating bool) error {
	var finalErr error

	wrappedSender := callResourceResponseSenderFunc(func(response *backend.CallResourceResponse) error {
		// err = errors.New("some validation error")
		admissionResponse := &admissionsV1.AdmissionResponse{}
		if err := json.Unmarshal(response.Body, &admissionResponse); err != nil {
			finalErr = errors.New("Admission response from plugin is malformed")
		}

		if !admissionResponse.Allowed {
			finalErr = admission.NewForbidden(a, errors.New("could not pass validation performed by plugin"))
		}

		return nil
	})

	kind := a.GetKind()
	userInfo := a.GetUserInfo()
	admissionRequest := &admissionsV1.AdmissionRequest{
		UID:             "0",
		Kind:            v1.GroupVersionKind(a.GetKind()),
		Resource:        v1.GroupVersionResource(a.GetResource()),
		SubResource:     a.GetSubresource(),
		RequestKind:     nil,
		RequestResource: nil,
		Name:            a.GetName(),
		Namespace:       a.GetNamespace(),
		Operation:       admissionsV1.Operation(a.GetOperation()),
		UserInfo: authenticationV1.UserInfo{
			Username: userInfo.GetName(),
			Groups:   userInfo.GetGroups(),
			UID:      userInfo.GetUID(),
		},
		Object: runtime.RawExtension{
			Object: a.GetObject(),
		},
		OldObject: runtime.RawExtension{
			Object: a.GetOldObject(),
		},
		DryRun:  nil,
		Options: runtime.RawExtension{},
	}

	admissionRequestBody, _ := json.Marshal(admissionRequest)
	path := "/k8s/admission/validation"

	if isMutating {
		path = "/k8s/admission/mutation"
	}
	if kind.Group == "charandas.example.com" && kind.Kind == "TestObject" {
		g.pluginsClient.CallResource(ctx, &backend.CallResourceRequest{
			Path:   path,
			Method: "POST",
			PluginContext: backend.PluginContext{
				OrgID:                      0,
				PluginID:                   "charandas-callbackadmissionexample-app",
				User:                       &backend.User{},
				AppInstanceSettings:        &backend.AppInstanceSettings{},
				DataSourceInstanceSettings: nil,
			},
			Body: admissionRequestBody,
		}, wrappedSender)
	}

	return finalErr
}

// Handles returns true if this admission controller can handle the given operation
// where operation can be one of CREATE, UPDATE, DELETE, or CONNECT
func (grpcCalloutAdmissionInPlugin) Handles(operation admission.Operation) bool {
	switch operation {
	case admission.Create, admission.Update:
		return true
	}
	return false
}

// NewGrpcCalloutAdmissionInPlugin creates an always deny admission handler
func NewGrpcCalloutAdmissionInPlugin(pluginsClient plugins.Client) admission.Interface {
	return &grpcCalloutAdmissionInPlugin{
		pluginsClient: pluginsClient,
	}
}

type callResourceResponseSenderFunc func(res *backend.CallResourceResponse) error

func (fn callResourceResponseSenderFunc) Send(res *backend.CallResourceResponse) error {
	return fn(res)
}
