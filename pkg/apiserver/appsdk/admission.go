package appsdk

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"slices"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/admission"

	"github.com/grafana/grafana-app-sdk/app"
	"github.com/grafana/grafana-app-sdk/resource"
)

type appAdmission struct {
	appGetter        func() app.App
	manifestData     app.ManifestData
	perKindAdmission map[string]app.AdmissionCapabilities
}

func newAppAdmission(md app.ManifestData, appGetter func() app.App) *appAdmission {
	adm := appAdmission{
		appGetter:        appGetter,
		manifestData:     md,
		perKindAdmission: make(map[string]app.AdmissionCapabilities),
	}
	for _, v := range md.Versions {
		for _, k := range v.Kinds {
			if k.Admission != nil {
				if !k.Admission.SupportsAnyValidation() && !k.Admission.SupportsAnyMutation() {
					continue
				}
				adm.perKindAdmission[admissionKindKey(md.Group, v.Name, k.Kind)] = *k.Admission
			}
		}
	}
	return &adm
}

var _ admission.MutationInterface = (*appAdmission)(nil)
var _ admission.ValidationInterface = (*appAdmission)(nil)

func (ad *appAdmission) Admit(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	adInfo := ad.getAdmissionInfo(a.GetKind())
	if adInfo == nil || !adInfo.SupportsAnyMutation() {
		return nil
	}

	req, err := translateAdmissionAttributes(a)
	if err != nil {
		return admission.NewForbidden(a, err)
	}

	supported := false
	for _, val := range adInfo.Mutation.Operations {
		if string(val) == string(req.Action) || val == app.AdmissionOperationAny {
			supported = true
			break
		}
	}
	if !supported {
		return nil
	}

	// Checked only after the kind and operation filters: every app's admission runs in one chain
	// against all requests, so an app that is still initializing must not reject other apps' writes.
	adApp := ad.appGetter()
	if adApp == nil {
		return admission.NewForbidden(a, errors.New("app is not initialized"))
	}

	res, err := adApp.Mutate(ctx, req)
	if err != nil {
		if errors.Is(err, app.ErrNotImplemented) {
			return nil
		}
		return admissionError(a, err)
	}

	obj := a.GetObject()
	if obj != nil && res.UpdatedObject != nil {
		reflect.ValueOf(obj).Elem().Set(reflect.ValueOf(res.UpdatedObject).Elem())
	}
	return nil
}

func (ad *appAdmission) Validate(ctx context.Context, a admission.Attributes, _ admission.ObjectInterfaces) error {
	adInfo := ad.getAdmissionInfo(a.GetKind())
	if adInfo == nil || !adInfo.SupportsAnyValidation() {
		return nil
	}

	req, err := translateAdmissionAttributes(a)
	if err != nil {
		return admission.NewForbidden(a, err)
	}

	supported := false
	for _, val := range adInfo.Validation.Operations {
		if string(val) == string(req.Action) || val == app.AdmissionOperationAny {
			supported = true
			break
		}
	}
	if !supported {
		return nil
	}

	adApp := ad.appGetter()
	if adApp == nil {
		return admission.NewForbidden(a, errors.New("app is not initialized"))
	}

	err = adApp.Validate(ctx, req)
	if err != nil {
		if errors.Is(err, app.ErrNotImplemented) {
			return nil
		}
		return admissionError(a, err)
	}
	return nil
}

// admissionError converts an error returned by an app's Validate or Mutate into the error returned to the apiserver.
// Errors which already carry a kubernetes status (such as those created by apierrors.NewInvalid) are returned
// with that status intact, and errors which implement resource.AdmissionError keep their status code and reason.
// All other errors are returned as a 403 Forbidden.
func admissionError(a admission.Attributes, err error) error {
	var apiStatus apierrors.APIStatus
	if errors.As(err, &apiStatus) {
		return &apierrors.StatusError{ErrStatus: apiStatus.Status()}
	}
	if admErr, ok := errors.AsType[resource.AdmissionError](err); ok {
		return &apierrors.StatusError{ErrStatus: metav1.Status{
			Status:  metav1.StatusFailure,
			Code:    int32(admErr.StatusCode()), //nolint:gosec // HTTP status codes fit in an int32
			Reason:  metav1.StatusReason(admErr.Reason()),
			Message: err.Error(),
		}}
	}
	return admission.NewForbidden(a, err)
}

func (ad *appAdmission) Handles(op admission.Operation) bool {
	if len(ad.perKindAdmission) == 0 {
		return false
	}
	for _, adm := range ad.perKindAdmission {
		var action app.AdmissionOperation
		switch op {
		case admission.Create:
			action = app.AdmissionOperationCreate
		case admission.Update:
			action = app.AdmissionOperationUpdate
		case admission.Delete:
			action = app.AdmissionOperationDelete
		case admission.Connect:
			action = app.AdmissionOperationConnect
		default:
			return false
		}
		if adm.SupportsAnyValidation() && (slices.Contains(adm.Validation.Operations, action) || slices.Contains(adm.Validation.Operations, app.AdmissionOperationAny)) {
			return true
		}
		if adm.SupportsAnyMutation() && (slices.Contains(adm.Mutation.Operations, action) || slices.Contains(adm.Mutation.Operations, app.AdmissionOperationAny)) {
			return true
		}
	}
	return false
}

func (ad *appAdmission) getAdmissionInfo(gvk schema.GroupVersionKind) *app.AdmissionCapabilities {
	if adm, ok := ad.perKindAdmission[admissionKindKey(gvk.Group, gvk.Version, gvk.Kind)]; ok {
		return &adm
	}
	return nil
}

// admissionKindKey builds the perKindAdmission map key for a group/version/kind. The group must be
// included: appAdmission instances from every installed app are chained together into one
// admission.Interface (see appinstaller.RegisterAdmission in Grafana core) and run against every
// request regardless of which app it targets, so a group-less "version/kind" key lets two unrelated
// apps whose kinds happen to share a Kind name and version (e.g. two apps both defining "Example"
// v1alpha1) collide and answer admission requests for each other's objects.
func admissionKindKey(group, version, kind string) string {
	return fmt.Sprintf("%s/%s/%s", group, version, kind)
}

func translateAdmissionAttributes(a admission.Attributes) (*app.AdmissionRequest, error) {
	if a == nil {
		return nil, errors.New("admission.Attributes cannot be nil")
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
	default:
		return nil, fmt.Errorf("unknown admission operation: %v", a.GetOperation())
	}

	var (
		obj    resource.Object
		oldObj resource.Object
		ok     bool
	)

	if a.GetObject() != nil {
		obj, ok = a.GetObject().(resource.Object)
		if !ok {
			return nil, admission.NewForbidden(a, errors.New("object is not a resource.Object"))
		}
	}

	if a.GetOldObject() != nil {
		oldObj, ok = a.GetOldObject().(resource.Object)
		if !ok {
			return nil, admission.NewForbidden(a, errors.New("oldObject is not a resource.Object"))
		}
	}

	userInfo := resource.AdmissionUserInfo{}
	// a.GetUserInfo() is nil for anonymous auth
	if a.GetUserInfo() != nil {
		extra := make(map[string]any)
		for k, v := range a.GetUserInfo().GetExtra() {
			extra[k] = any(v)
		}
		userInfo.UID = a.GetUserInfo().GetUID()
		userInfo.Username = a.GetUserInfo().GetName()
		userInfo.Groups = a.GetUserInfo().GetGroups()
		userInfo.Extra = extra
	}

	req := app.AdmissionRequest{
		Action:    action,
		Kind:      a.GetKind().Kind,
		Group:     a.GetKind().Group,
		Version:   a.GetKind().Version,
		UserInfo:  userInfo,
		Object:    obj,
		OldObject: oldObj,
	}

	return &req, nil
}
