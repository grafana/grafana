package generic

import (
	"context"
	"fmt"
	"time"

	"k8s.io/apimachinery/pkg/api/meta"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/labels"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/util/validation/field"
	"k8s.io/apiserver/pkg/registry/rest"
	"k8s.io/apiserver/pkg/storage"
	"k8s.io/apiserver/pkg/storage/names"

	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/auth/identity"
)

type StrategyOptions struct {
	// Check if the requester can write the resource to selected folder
	FolderAccess func(ctx context.Context, user identity.Requester, folder string) bool
	// Check if the requester can write the resource to selected origin
	OriginAccess func(ctx context.Context, user identity.Requester, origin string) bool
}

type genericStrategy struct {
	runtime.ObjectTyper
	names.NameGenerator
	folderAccess func(ctx context.Context, user identity.Requester, folder string) bool
	originAccess func(ctx context.Context, user identity.Requester, origin string) bool
}

// NewStrategy creates and returns a genericStrategy instance.
func NewStrategy(typer runtime.ObjectTyper, opts ...StrategyOptions) rest.RESTCreateUpdateStrategy {
	s := &genericStrategy{
		ObjectTyper:   typer,
		NameGenerator: names.SimpleNameGenerator,
	}
	for _, op := range opts {
		if op.FolderAccess != nil {
			s.folderAccess = op.FolderAccess
		}
		if op.OriginAccess != nil {
			s.originAccess = op.OriginAccess
		}
	}
	return s
}

// NamespaceScoped returns true because all Generic resources must be within a namespace.
func (genericStrategy) NamespaceScoped() bool {
	return true
}

func (s *genericStrategy) validateCommon(ctx context.Context, user identity.Requester, meta utils.GrafanaResourceMetaAccessor, errors field.ErrorList) field.ErrorList {
	// Do not allow people to write object to folders when not supported
	folder := meta.GetFolder()
	if folder != "" {
		if s.folderAccess == nil {
			errors = append(errors, &field.Error{
				Type:     field.ErrorTypeForbidden,
				Field:    "metadata.annotations#" + utils.AnnoKeyFolder,
				BadValue: folder,
				Detail:   "Folders are not supported for this resource",
			})
		} else if !s.folderAccess(ctx, user, folder) {
			errors = append(errors, &field.Error{
				Type:     field.ErrorTypeForbidden,
				Field:    "metadata.annotations#" + utils.AnnoKeyFolder,
				BadValue: folder,
				Detail:   "Folders are not supported for this resource",
			})
		}
	}

	// Ensure the origin properties are clean
	origin, err := meta.GetOriginInfo()
	if err != nil {
		errors = append(errors, &field.Error{
			Type:     field.ErrorTypeInternal,
			Field:    "metadata.annotations#" + utils.AnnoKeyFolder,
			BadValue: folder,
			Detail:   err.Error(),
		})
		// } else if origin != nil {
		// 	// TODO? filter origin checks?
	}
	meta.SetOriginInfo(origin) // Writing it will clean up any bad inputs
	return errors
}

// Creation setup -- no errors, typically just to remove things that can not be there
func (genericStrategy) PrepareForCreate(ctx context.Context, obj runtime.Object) {
	//fmt.Printf("PrepareForCreate %v\n", obj.GetObjectKind().GroupVersionKind())
}

// Validate on create
func (s *genericStrategy) Validate(ctx context.Context, obj runtime.Object) field.ErrorList {
	user, err := appcontext.User(ctx)
	if err != nil {
		return field.ErrorList{&field.Error{
			Type:   field.ErrorTypeForbidden,
			Detail: fmt.Sprintf("unable to get user // %s", err),
		}}
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return field.ErrorList{&field.Error{
			Type:   field.ErrorTypeInternal,
			Detail: fmt.Sprintf("object not meta accessible // %s", err),
		}}
	}

	meta.SetCreatedBy(user.GetID().String())
	meta.SetUpdatedBy("")
	meta.SetUpdatedTimestamp(nil)

	return s.validateCommon(ctx, user, meta, field.ErrorList{})
}

// WarningsOnCreate returns warnings for the creation of the given object.
func (s *genericStrategy) WarningsOnCreate(ctx context.Context, obj runtime.Object) []string {
	// fmt.Printf("WarningsOnCreate %v\n", obj.GetObjectKind().GroupVersionKind())
	return nil
}

func (s *genericStrategy) PrepareForUpdate(ctx context.Context, obj, old runtime.Object) {
	// fmt.Printf("PrepareForUpdate %v\n", obj.GetObjectKind().GroupVersionKind())
	// TODO... clear status
}

func (s *genericStrategy) ValidateUpdate(ctx context.Context, obj, old runtime.Object) field.ErrorList {
	if old == nil {
		return s.Validate(ctx, obj) // This is actually a Create -- is this called?
	}

	user, err := appcontext.User(ctx)
	if err != nil {
		return field.ErrorList{&field.Error{
			Type:   field.ErrorTypeForbidden,
			Detail: fmt.Sprintf("unable to get user // %s", err),
		}}
	}

	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return field.ErrorList{&field.Error{
			Type:   field.ErrorTypeInternal,
			Detail: fmt.Sprintf("object not meta accessible // %s", err),
		}}
	}
	meta.SetUpdatedBy(user.GetID().String())
	meta.SetUpdatedTimestamp(toPtr(time.Now()))

	// The creation user can not be changed
	oldmeta, err := utils.MetaAccessor(old)
	if err != nil {
		return field.ErrorList{&field.Error{
			Type:   field.ErrorTypeInternal,
			Detail: fmt.Sprintf("old object not meta accessible // %s", err),
		}}
	}
	meta.SetCreatedBy(oldmeta.GetCreatedBy()) // This can not change!

	return s.validateCommon(ctx, user, meta, field.ErrorList{})
}

// WarningsOnUpdate returns warnings for the given update.
func (genericStrategy) WarningsOnUpdate(ctx context.Context, obj, old runtime.Object) []string {
	fmt.Printf("WarningsOnUpdate %v\n", obj.GetObjectKind().GroupVersionKind())
	return nil
}

func (genericStrategy) AllowCreateOnUpdate() bool {
	return true
}

func (genericStrategy) AllowUnconditionalUpdate() bool {
	return true // all an update when `resourceVersion` is not specified
}

func (genericStrategy) Canonicalize(obj runtime.Object) {}

// GetAttrs returns labels and fields of an object.
func GetAttrs(obj runtime.Object) (labels.Set, fields.Set, error) {
	accessor, err := meta.Accessor(obj)
	if err != nil {
		return nil, nil, err
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, nil, err
	}
	labels := labels.Set(accessor.GetLabels())
	fields := fields.Set{
		"metadata.name": accessor.GetName(),
	}

	v := meta.GetFolder()
	if v != "" {
		labels[utils.AnnoKeyFolder] = v
	}
	v = meta.GetOriginName()
	if v != "" {
		labels[utils.AnnoKeyOriginName] = v
	}

	return labels, fields, nil
}

// Matcher returns a generic.SelectionPredicate that matches on label and field selectors.
func Matcher(label labels.Selector, field fields.Selector) storage.SelectionPredicate {
	return storage.SelectionPredicate{
		Label:    label,
		Field:    field,
		GetAttrs: GetAttrs,
	}
}

func toPtr[T any](v T) *T {
	return &v
}
