package resource

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

// Verify that all required fields are set, and the user has permission to set the common metadata fields
type RequestValidator interface {
	ValidateCreate(ctx context.Context, req *CreateRequest) (utils.GrafanaMetaAccessor, error)
	ValidateUpdate(ctx context.Context, req *UpdateRequest, current *GetResourceResponse) (utils.GrafanaMetaAccessor, error)
}

type simpleValidator struct {
	folderAccess func(ctx context.Context, user identity.Requester, uid string) bool
	originAccess func(ctx context.Context, user identity.Requester, origin string) bool
}

func NewSimpleValidator() RequestValidator {
	return &simpleValidator{
		// folderAccess: func(ctx context.Context, user identity.Requester, uid string) bool {
		// 	return true // for now you can right anything to any folder
		// },
	}
}

type dummyObject struct {
	metav1.TypeMeta   `json:",inline"`
	metav1.ObjectMeta `json:"metadata,omitempty"`
}

var _ RequestValidator = &simpleValidator{}

func readValue(ctx context.Context, value []byte) (identity.Requester, utils.GrafanaMetaAccessor, error) {
	// TODO -- we just need Identity not a full user!
	user, err := appcontext.User(ctx)
	if err != nil {
		return nil, nil, err
	}

	dummy := &dummyObject{}
	err = json.Unmarshal(value, dummy)
	if err != nil {
		return nil, nil, err
	}

	obj, err := utils.MetaAccessor(dummy)
	return user, obj, err
}

// This is the validation that happens for both CREATE and UPDATE
func (v *simpleValidator) validate(ctx context.Context, user identity.Requester, obj utils.GrafanaMetaAccessor) (utils.GrafanaMetaAccessor, error) {
	// To avoid confusion, lets not include the resource version in the saved value
	// This is a little weird, but it means there won't be confusion that the saved value
	// is likely the previous resource version!
	if obj.GetResourceVersion() != "" {
		return obj, fmt.Errorf("do not save the resource version in the value")
	}

	// Make sure all common fields are populated
	if obj.GetName() == "" {
		return obj, fmt.Errorf("missing name")
	}
	if obj.GetAPIVersion() == "" {
		return obj, fmt.Errorf("missing apiversion")
	}
	if obj.GetUID() == "" {
		return obj, fmt.Errorf("the uid is not configured")
	}

	// Check folder access
	folder := obj.GetFolder()
	if folder != "" {
		if v.folderAccess == nil {
			return obj, fmt.Errorf("folder access not supported")
		} else if !v.folderAccess(ctx, user, folder) {
			return obj, fmt.Errorf("not allowed to write resource to folder")
		}
	}

	// Make sure you can write values to this origin
	origin, err := obj.GetOriginInfo()
	if err != nil {
		return nil, err
	}
	if origin != nil && v.originAccess != nil && !v.originAccess(ctx, user, origin.Name) {
		return obj, fmt.Errorf("not allowed to write values to this origin")
	}

	return obj, nil
}

func (v *simpleValidator) ValidateCreate(ctx context.Context, req *CreateRequest) (utils.GrafanaMetaAccessor, error) {
	user, obj, err := readValue(ctx, req.Value)
	if err != nil {
		return nil, err
	}
	if obj.GetKind() != req.Key.Resource {
		return obj, fmt.Errorf("expected resource kind")
	}
	if req.Key.ResourceVersion > 0 {
		return obj, fmt.Errorf("create key must not include a resource version")
	}

	// Make sure the created by user is accurate
	//----------------------------------------
	val := obj.GetCreatedBy()
	if val != "" && val != user.GetUID().String() {
		return obj, fmt.Errorf("created by annotation does not match: metadata.annotations#" + utils.AnnoKeyCreatedBy)
	}

	// Create can not have updated properties
	//----------------------------------------
	if obj.GetUpdatedBy() != "" {
		return obj, fmt.Errorf("unexpected metadata.annotations#" + utils.AnnoKeyCreatedBy)
	}
	ts, err := obj.GetUpdatedTimestamp()
	if err != nil {
		return obj, nil
	}
	if ts != nil {
		return obj, fmt.Errorf("unexpected metadata.annotations#" + utils.AnnoKeyUpdatedTimestamp)
	}

	return v.validate(ctx, user, obj)
}

func (v *simpleValidator) ValidateUpdate(ctx context.Context, req *UpdateRequest, current *GetResourceResponse) (utils.GrafanaMetaAccessor, error) {
	user, obj, err := readValue(ctx, req.Value)
	if err != nil {
		return nil, err
	}
	if obj.GetKind() != req.Key.Resource {
		return obj, fmt.Errorf("expected resource kind")
	}

	if req.Key.ResourceVersion > 0 && req.Key.ResourceVersion != current.ResourceVersion {
		return obj, fmt.Errorf("resource version does not match (optimistic locking)")
	}

	_, oldobj, err := readValue(ctx, current.Value)
	if err != nil {
		return nil, err
	}
	if obj.GetCreatedBy() != oldobj.GetCreatedBy() {
		return obj, fmt.Errorf(utils.AnnoKeyCreatedBy + " value has changed")
	}
	if obj.GetCreationTimestamp() != oldobj.GetCreationTimestamp() {
		return obj, fmt.Errorf("creation time changed")
	}

	// Make sure the update user is accurate
	//----------------------------------------
	val := obj.GetUpdatedBy()
	if val != "" && val != user.GetUID().String() {
		return obj, fmt.Errorf("created by annotation does not match: metadata.annotations#" + utils.AnnoKeyUpdatedBy)
	}

	return v.validate(ctx, user, obj)
}
