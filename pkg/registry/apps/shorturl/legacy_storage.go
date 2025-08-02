package shorturl

import (
	"context"
	"errors"
	"fmt"
	"strings"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"

	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/shorturls"
	"github.com/grafana/grafana/pkg/services/user"
)

var (
	_ rest.Scoper               = (*legacyStorage)(nil)
	_ rest.SingularNameProvider = (*legacyStorage)(nil)
	_ rest.Getter               = (*legacyStorage)(nil)
	_ rest.Storage              = (*legacyStorage)(nil)
	_ rest.Creater              = (*legacyStorage)(nil)
	_ rest.Updater              = (*legacyStorage)(nil)
	_ rest.GracefulDeleter      = (*legacyStorage)(nil)
)

type legacyStorage struct {
	service        shorturls.Service
	namespacer     request.NamespaceMapper
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return shorturl.ShortURLKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(shorturl.ShortURLKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return shorturl.ShortURLKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("List for shorturl not implemented")
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// Convert identity.Requester to *user.SignedInUser
	var signedInUser *user.SignedInUser
	if authnIdentity, ok := requester.(*authn.Identity); ok {
		signedInUser = authnIdentity.SignedInUser()
	} else if userIdentity, ok := requester.(*user.SignedInUser); ok {
		signedInUser = userIdentity
	} else {
		return nil, fmt.Errorf("unsupported identity type")
	}

	dto, err := s.service.GetShortURLByUID(ctx, signedInUser, name)
	if err != nil || dto == nil {
		if errors.Is(err, shorturls.ErrShortURLNotFound) || err == nil {
			err = k8serrors.NewNotFound(schema.GroupResource{
				Group:    shorturl.ShortURLKind().Group(),
				Resource: shorturl.ShortURLKind().Plural(),
			}, name)
		}
		return nil, err
	}

	return convertToK8sResource(dto, s.namespacer), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	// Convert identity.Requester to *user.SignedInUser
	var signedInUser *user.SignedInUser
	if authnIdentity, ok := requester.(*authn.Identity); ok {
		signedInUser = authnIdentity.SignedInUser()
	} else if userIdentity, ok := requester.(*user.SignedInUser); ok {
		signedInUser = userIdentity
	} else {
		return nil, fmt.Errorf("unsupported identity type")
	}

	p, ok := obj.(*shorturl.ShortURL)
	if !ok {
		return nil, fmt.Errorf("expected shorturl?")
	}
	out, err := s.service.CreateShortURL(ctx, signedInUser, p.Spec.Path)
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, out.Uid, nil)
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("Update for shorturl not implemented")
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("Delete for shorturl not implemented")
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for shorturl not implemented")
}
