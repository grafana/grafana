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
	"github.com/grafana/grafana/pkg/api/dtos"
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

	if createValidation != nil {
		if err := createValidation(ctx, obj.DeepCopyObject()); err != nil {
			return nil, err
		}
	}
	p, ok := obj.(*shorturl.ShortURL)
	if !ok {
		return nil, fmt.Errorf("expected shorturl?")
	}
	cmd := &dtos.CreateShortURLCmd{
		Path: p.Spec.Path,
		UID:  p.Name,
	}
	out, err := s.service.CreateShortURL(ctx, signedInUser, cmd)
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
	// For other updates, use the original logic
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	// Convert identity.Requester to *user.SignedInUser
	var signedInUser *user.SignedInUser
	if authnIdentity, ok := requester.(*authn.Identity); ok {
		signedInUser = authnIdentity.SignedInUser()
	} else if userIdentity, ok := requester.(*user.SignedInUser); ok {
		signedInUser = userIdentity
	} else {
		return nil, false, fmt.Errorf("unsupported identity type")
	}

	shortURL, err := s.service.GetShortURLByUID(ctx, signedInUser, name)
	if err != nil || shortURL == nil {
		if errors.Is(err, shorturls.ErrShortURLNotFound) || err == nil {
			err = k8serrors.NewNotFound(schema.GroupResource{
				Group:    shorturl.ShortURLKind().Group(),
				Resource: shorturl.ShortURLKind().Plural(),
			}, name)
		}
		return nil, false, err
	}

	err = s.service.UpdateLastSeenAt(ctx, shortURL)
	if err != nil {
		return nil, false, err
	}
	// Fetch the updated short URL to return
	updatedLegacyShortURL, err := s.service.GetShortURLByUID(ctx, signedInUser, name)
	if err != nil {
		return nil, false, err
	}

	return convertToK8sResource(updatedLegacyShortURL, s.namespacer), true, nil
}

// GracefulDeleter
func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	v, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return v, false, err // includes the not-found error
	}
	p, ok := v.(*shorturl.ShortURL)
	if !ok {
		return v, false, fmt.Errorf("expected a shorturl response from Get")
	}
	err = s.service.DeleteStaleShortURLs(ctx, &shorturls.DeleteShortUrlCommand{Uid: name})
	return p, true, err // true is instant delete
}

// CollectionDeleter
func (s *legacyStorage) DeleteCollection(ctx context.Context, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions, listOptions *internalversion.ListOptions) (runtime.Object, error) {
	return nil, fmt.Errorf("DeleteCollection for shorturl not implemented")
}
