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
	"errors"
	"io"

	"k8s.io/apiserver/pkg/admission"
)

const PluginNameDenyByName = "DenyByName"

// Register registers a plugin
func RegisterDenyByName(plugins *admission.Plugins) {
	plugins.Register(PluginNameDenyByName, func(config io.Reader) (admission.Interface, error) {
		return NewDenyByName(), nil
	})
}

// example of admission plugin that will deny any resource with name "deny"
type denyByName struct{}

var _ admission.MutationInterface = denyByName{}
var _ admission.ValidationInterface = denyByName{}

// Admit makes an admission decision based on the request attributes.
func (denyByName) Admit(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	return nil
}

// Validate makes an admission decision based on the request attributes.  It is NOT allowed to mutate.
func (denyByName) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	if a.GetName() == "deny" {
		return admission.NewForbidden(a, errors.New("admission control is denying all modifications"))
	}
	return nil
}

// Handles returns true if this admission controller can handle the given operation
// where operation can be one of CREATE, UPDATE, DELETE, or CONNECT
func (denyByName) Handles(operation admission.Operation) bool {
	return true
}

// NewDenyByName creates an always deny admission handler
func NewDenyByName() admission.Interface {
	return new(denyByName)
}
