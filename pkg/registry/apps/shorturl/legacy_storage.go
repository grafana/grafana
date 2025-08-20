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
	"github.com/grafana/grafana/pkg/services/org"
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
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	shortURLs, err := s.service.List(ctx, orgID)
	if err != nil {
		if errors.Is(err, shorturls.ErrShortURLNotFound) {
			return shorturl.ShortURLKind().ZeroListValue(), nil // return empty list if no short URLs found
		}
		return nil, err
	}

	list := &shorturl.ShortURLList{}
	for idx := range shortURLs {
		list.Items = append(list.Items, *convertToK8sResource(shortURLs[idx], s.namespacer))
	}

	return list, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	// Convert any identity.Requester to *user.SignedInUser
	signedInUser, err := convertRequesterToSignedInUser(requester)
	if err != nil {
		return nil, fmt.Errorf("failed to convert requester: %w", err)
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

	// Convert any identity.Requester to *user.SignedInUser
	signedInUser, err := convertRequesterToSignedInUser(requester)
	if err != nil {
		return nil, fmt.Errorf("failed to convert requester: %w", err)
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

	// Convert any identity.Requester to *user.SignedInUser
	signedInUser, err := convertRequesterToSignedInUser(requester)
	if err != nil {
		return nil, false, fmt.Errorf("failed to convert requester: %w", err)
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

// convertRequesterToSignedInUser converts any identity.Requester to *user.SignedInUser
// This is needed because some legacy shorturls service methods still expect SignedInUser
func convertRequesterToSignedInUser(requester identity.Requester) (*user.SignedInUser, error) {
	// If it's already a SignedInUser, return it directly
	if signedInUser, ok := requester.(*user.SignedInUser); ok {
		return signedInUser, nil
	}

	// If it's an authn.Identity, use its SignedInUser method
	if authnIdentity, ok := requester.(*authn.Identity); ok {
		return authnIdentity.SignedInUser(), nil
	}

	// For all other identity types (background services, etc.), create a simple background user
	orgID := requester.GetOrgID()
	if orgID <= 0 {
		orgID = 1 // Default to org 1 for system operations
	}

	return &user.SignedInUser{
		OrgID:   orgID,
		OrgRole: org.RoleAdmin, // Background services need admin access for cleanup operations
		Login:   "grafana_background_service",
	}, nil
}
