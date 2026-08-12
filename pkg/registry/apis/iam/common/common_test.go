package common

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
	"k8s.io/apiserver/pkg/endpoints/request"

	authlib "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/acimpl"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

func TestList(t *testing.T) {
	ac := acimpl.ProvideAccessControl(featuremgmt.WithFeatures())

	t.Run("should allow all items if no access client is passed", func(t *testing.T) {
		ctx := newContext("stacks-1", newIdent())

		res, err := List(ctx, utils.NewResourceInfo("", "", "items", "", "", nil, nil, utils.TableColumns{}), nil, Pagination{Limit: 2}, func(ctx context.Context, ns authlib.NamespaceInfo, p Pagination) (*ListResponse[item], error) {
			return &ListResponse[item]{
				Items: []item{{"1"}, {"2"}},
			}, nil
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 2)
	})

	t.Run("should filter out items that are allowed", func(t *testing.T) {
		ctx := newContext("stacks-1", newIdent(accesscontrol.Permission{Action: "items:read", Scope: "items:uid:1"}))

		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "items",
			Attr:     "uid",
		})
		res, err := List(ctx, utils.NewResourceInfo("", "", "items", "", "", nil, nil, utils.TableColumns{}), a, Pagination{Limit: 2}, func(ctx context.Context, ns authlib.NamespaceInfo, p Pagination) (*ListResponse[item], error) {
			return &ListResponse[item]{
				Items: []item{{"1"}, {"2"}},
			}, nil
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 1)
	})

	t.Run("should fetch more for partial response with continue token", func(t *testing.T) {
		ctx := newContext("stacks-1", newIdent(
			accesscontrol.Permission{Action: "items:read", Scope: "items:uid:1"},
			accesscontrol.Permission{Action: "items:read", Scope: "items:uid:3"},
		))

		a := accesscontrol.NewLegacyAccessClient(ac, accesscontrol.ResourceAuthorizerOptions{
			Resource: "items",
			Attr:     "uid",
		})

		var called bool

		res, err := List(ctx, utils.NewResourceInfo("", "", "items", "", "", nil, nil, utils.TableColumns{}), a, Pagination{Limit: 2}, func(ctx context.Context, ns authlib.NamespaceInfo, p Pagination) (*ListResponse[item], error) {
			if called {
				return &ListResponse[item]{
					Items: []item{{"3"}},
				}, nil
			}

			called = true
			return &ListResponse[item]{
				Items:    []item{{"1"}, {"2"}},
				Continue: 3,
			}, nil
		})
		assert.NoError(t, err)
		assert.Len(t, res.Items, 2)

		assert.Equal(t, "1", res.Items[0].GetName())
		assert.Equal(t, "3", res.Items[1].GetName())
	})
}

func newContext(namespace string, ident *identity.StaticRequester) context.Context {
	return request.WithNamespace(identity.WithRequester(context.Background(), ident), namespace)
}

func newIdent(permissions ...accesscontrol.Permission) *identity.StaticRequester {
	pmap := map[string][]string{}
	for _, p := range permissions {
		pmap[p.Action] = append(pmap[p.Action], p.Scope)
	}

	return &identity.StaticRequester{
		OrgID:       1,
		Permissions: map[int64]map[string][]string{1: pmap},
	}
}

var _ metav1.Object = (*item)(nil)

type item struct {
	id string
}

// GetAnnotations implements v1.Object.
func (i item) GetAnnotations() map[string]string {
	panic("unimplemented")
}

// GetCreationTimestamp implements v1.Object.
func (i item) GetCreationTimestamp() metav1.Time {
	panic("unimplemented")
}

// GetDeletionGracePeriodSeconds implements v1.Object.
func (i item) GetDeletionGracePeriodSeconds() *int64 {
	panic("unimplemented")
}

// GetDeletionTimestamp implements v1.Object.
func (i item) GetDeletionTimestamp() *metav1.Time {
	panic("unimplemented")
}

// GetFinalizers implements v1.Object.
func (i item) GetFinalizers() []string {
	panic("unimplemented")
}

// GetGenerateName implements v1.Object.
func (i item) GetGenerateName() string {
	panic("unimplemented")
}

// GetGeneration implements v1.Object.
func (i item) GetGeneration() int64 {
	panic("unimplemented")
}

// GetLabels implements v1.Object.
func (i item) GetLabels() map[string]string {
	panic("unimplemented")
}

// GetManagedFields implements v1.Object.
func (i item) GetManagedFields() []metav1.ManagedFieldsEntry {
	panic("unimplemented")
}

// GetNamespace implements v1.Object.
func (i item) GetNamespace() string {
	panic("unimplemented")
}

// GetOwnerReferences implements v1.Object.
func (i item) GetOwnerReferences() []metav1.OwnerReference {
	panic("unimplemented")
}

// GetResourceVersion implements v1.Object.
func (i item) GetResourceVersion() string {
	panic("unimplemented")
}

// GetSelfLink implements v1.Object.
func (i item) GetSelfLink() string {
	panic("unimplemented")
}

// GetUID implements v1.Object.
func (i item) GetUID() types.UID {
	panic("unimplemented")
}

// SetAnnotations implements v1.Object.
func (i item) SetAnnotations(annotations map[string]string) {
	panic("unimplemented")
}

// SetCreationTimestamp implements v1.Object.
func (i item) SetCreationTimestamp(timestamp metav1.Time) {
	panic("unimplemented")
}

// SetDeletionGracePeriodSeconds implements v1.Object.
func (i item) SetDeletionGracePeriodSeconds(*int64) {
	panic("unimplemented")
}

// SetDeletionTimestamp implements v1.Object.
func (i item) SetDeletionTimestamp(timestamp *metav1.Time) {
	panic("unimplemented")
}

// SetFinalizers implements v1.Object.
func (i item) SetFinalizers(finalizers []string) {
	panic("unimplemented")
}

// SetGenerateName implements v1.Object.
func (i item) SetGenerateName(name string) {
	panic("unimplemented")
}

// SetGeneration implements v1.Object.
func (i item) SetGeneration(generation int64) {
	panic("unimplemented")
}

// SetLabels implements v1.Object.
func (i item) SetLabels(labels map[string]string) {
	panic("unimplemented")
}

// SetManagedFields implements v1.Object.
func (i item) SetManagedFields(managedFields []metav1.ManagedFieldsEntry) {
	panic("unimplemented")
}

// SetName implements v1.Object.
func (i item) SetName(name string) {
	panic("unimplemented")
}

// SetNamespace implements v1.Object.
func (i item) SetNamespace(namespace string) {
	panic("unimplemented")
}

// SetOwnerReferences implements v1.Object.
func (i item) SetOwnerReferences([]metav1.OwnerReference) {
	panic("unimplemented")
}

// SetResourceVersion implements v1.Object.
func (i item) SetResourceVersion(version string) {
	panic("unimplemented")
}

// SetSelfLink implements v1.Object.
func (i item) SetSelfLink(selfLink string) {
	panic("unimplemented")
}

// SetUID implements v1.Object.
func (i item) SetUID(uid types.UID) {
	panic("unimplemented")
}

func (i item) GetName() string {
	return i.id
}
