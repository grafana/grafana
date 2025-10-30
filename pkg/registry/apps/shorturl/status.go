package shorturl

import (
	"context"
	"errors"
	"fmt"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	"sigs.k8s.io/structured-merge-diff/v6/fieldpath"

	"github.com/grafana/grafana-app-sdk/k8s/apiserver"
	"github.com/grafana/grafana-app-sdk/logging"
	shorturl "github.com/grafana/grafana/apps/shorturl/pkg/apis/shorturl/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/shorturls"
)

type statusDualWriter struct {
	gv     schema.GroupVersion
	status *apiserver.StatusREST
	legacy *legacyStorage
}

var (
	_ rest.Patcher             = (*statusDualWriter)(nil)
	_ rest.Storage             = (*statusDualWriter)(nil)
	_ rest.ResetFieldsStrategy = (*statusDualWriter)(nil)
)

// Destroy implements rest.Storage.
func (s *statusDualWriter) Destroy() {}

// New implements rest.Storage.
func (s *statusDualWriter) New() runtime.Object {
	return s.legacy.New()
}

// Get implements rest.Patcher.
func (s *statusDualWriter) Get(ctx context.Context, name string, options *v1.GetOptions) (runtime.Object, error) {
	return s.legacy.Get(ctx, name, options)
}

// Update implements rest.Patcher.
func (s *statusDualWriter) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *v1.UpdateOptions) (runtime.Object, bool, error) {
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	shortURL, err := s.legacy.service.GetShortURLByUID(ctx, requester, name)
	if err != nil || shortURL == nil {
		if errors.Is(err, shorturls.ErrShortURLNotFound) || err == nil {
			err = k8serrors.NewNotFound(shorturl.ShortURLKind().GroupVersionResource().GroupResource(), name)
		}
		return nil, false, err
	}

	// This ignores the incoming and updates it directly
	err = s.legacy.service.UpdateLastSeenAt(ctx, shortURL)
	if err != nil {
		return nil, false, err
	}

	getter := func(getter rest.Getter) (*shorturl.ShortURL, error) {
		obj, err := getter.Get(ctx, name, &v1.GetOptions{})
		if err != nil {
			return nil, err
		}
		val, ok := obj.(*shorturl.ShortURL)
		if !ok {
			return nil, fmt.Errorf("expected ShortURL but got %T", obj)
		}
		return val, nil
	}

	legacy, err := getter(s.legacy)
	if err != nil {
		return nil, false, err // unable to get legacy object
	}

	unified, err := getter(s.status)
	if err != nil {
		logging.FromContext(ctx).Warn("unable to read unified status", "error", err)
		return legacy, false, nil
	}

	// Use the same status from legacy in unified
	unified.Status = legacy.Status

	_, _, err = s.status.Update(ctx, name, rest.DefaultUpdatedObjectInfo(unified), createValidation, updateValidation, false, options)
	if err != nil {
		logging.FromContext(ctx).Warn("error updating unified status", "error", err)
	}

	return legacy, false, err
}

// GetResetFields implements rest.ResetFieldsStrategy
func (s *statusDualWriter) GetResetFields() map[fieldpath.APIVersion]*fieldpath.Set {
	fields := map[fieldpath.APIVersion]*fieldpath.Set{
		fieldpath.APIVersion(s.gv.String()): fieldpath.NewSet(
			fieldpath.MakePathOrDie("spec"),
			fieldpath.MakePathOrDie("metadata"),
		),
	}
	return fields
}
