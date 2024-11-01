package runner

import (
	"context"
	"errors"
	"reflect"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
	"k8s.io/apiserver/pkg/admission"
)

func (b *AppBuilder) Mutate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	if b.app == nil {
		return errors.New("app is nil")
	}

	req, err := b.translateAdmissionAttributes(a)
	if err != nil {
		return err
	}

	resp, err := b.app.Mutate(ctx, req)
	if err != nil {
		if errors.Is(err, app.ErrNotImplemented) {
			return nil
		}
		return err
	}

	obj := a.GetObject()
	if obj == nil {
		return errors.New("object is nil")
	}
	if resp.UpdatedObject == nil {
		return errors.New("updated object is nil")
	}
	reflect.ValueOf(obj).Elem().Set(reflect.ValueOf(resp.UpdatedObject).Elem())

	return nil
}

func (b *AppBuilder) Validate(ctx context.Context, a admission.Attributes, o admission.ObjectInterfaces) (err error) {
	req, err := b.translateAdmissionAttributes(a)
	if err != nil {
		return err
	}
	err = b.app.Validate(ctx, req)
	if err != nil {
		if errors.Is(err, app.ErrNotImplemented) {
			return nil
		}
		return err
	}
	return nil
}

func (b *AppBuilder) translateAdmissionAttributes(a admission.Attributes) (*app.AdmissionRequest, error) {
	extra := make(map[string]any)
	for k, v := range a.GetUserInfo().GetExtra() {
		extra[k] = any(v)
	}

	var action resource.AdmissionAction
	switch a.GetOperation() {
	case admission.Create:
		action = resource.AdmissionActionCreate
	case admission.Update:
		action = resource.AdmissionActionUpdate
	case admission.Delete:
		action = resource.AdmissionActionDelete
	case admission.Connect:
		action = resource.AdmissionActionConnect
	}

	var (
		obj    resource.Object
		oldObj resource.Object
	)

	if a.GetObject() != nil {
		obj = a.GetObject().(resource.Object)
	}

	if a.GetOldObject() != nil {
		oldObj = a.GetOldObject().(resource.Object)
	}

	req := app.AdmissionRequest{
		Action:  action,
		Kind:    a.GetKind().Kind,
		Group:   a.GetKind().Group,
		Version: a.GetKind().Version,
		UserInfo: resource.AdmissionUserInfo{
			UID:      a.GetUserInfo().GetUID(),
			Username: a.GetUserInfo().GetName(),
			Groups:   a.GetUserInfo().GetGroups(),
			Extra:    extra,
		},
		Object:    obj,
		OldObject: oldObj,
	}

	return &req, nil
}
