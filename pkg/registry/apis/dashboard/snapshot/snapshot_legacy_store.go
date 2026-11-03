package snapshot

import (
	"context"
	"errors"
	"fmt"

	"github.com/open-feature/go-sdk/openfeature"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	k8srequest "k8s.io/apiserver/pkg/endpoints/request"
	"k8s.io/apiserver/pkg/registry/rest"

	dashV0 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/dashboardsnapshots"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
)

var (
	_ grafanarest.Storage = (*SnapshotLegacyStore)(nil)
)

type SnapshotLegacyStore struct {
	ResourceInfo          utils.ResourceInfo
	Service               dashboardsnapshots.Service
	Namespacer            request.NamespaceMapper
	ExternalSnapshotToken string
}

func (s *SnapshotLegacyStore) New() runtime.Object {
	return s.ResourceInfo.NewFunc()
}

func (s *SnapshotLegacyStore) Destroy() {}

func (s *SnapshotLegacyStore) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *SnapshotLegacyStore) GetSingularName() string {
	return s.ResourceInfo.GetSingularName()
}

func (s *SnapshotLegacyStore) NewList() runtime.Object {
	return s.ResourceInfo.NewListFunc()
}

func (s *SnapshotLegacyStore) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.ResourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

// GracefulDeleter
func (s *SnapshotLegacyStore) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	snap, err := s.Service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	})
	if err != nil || snap == nil {
		return nil, false, err
	}

	// Snapshots are org-scoped, but lookups by key are global. Reject deletes that
	// target a snapshot owned by a different org than the caller's namespace, and
	// return NotFound (rather than a distinct error) so the endpoint does not become
	// a cross-org existence oracle.
	ns, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	if snap.OrgID != ns.OrgID {
		return nil, false, s.ResourceInfo.NewNotFound(name)
	}

	// Delete the external one first. Rebuild old URLs when the configured protocol
	// changed, but skip a duplicate request only when the effective endpoint matches.
	completedDeleteURL, _ := ctx.Value(externalSnapshotDeleteURLKey{}).(string)
	if snap.ExternalDeleteURL != "" {
		kubernetesPush := openfeature.NewDefaultClient().Boolean(ctx, featuremgmt.FlagExternalSnapshotsK8SAPIPush, false, openfeature.TransactionContext(ctx))
		deleteURL, err := externalSnapshotDeleteEndpoint(snap.ExternalDeleteURL, snap.DeleteKey, kubernetesPush)
		if err != nil {
			return nil, false, err
		}
		if completedDeleteURL != deleteURL {
			if kubernetesPush {
				err = deleteExternalSnapshot(deleteURL, s.ExternalSnapshotToken)
			} else {
				err = deleteExternalSnapshotLegacy(deleteURL)
			}
			if err != nil {
				return nil, false, err
			}
		}
	}

	err = s.Service.DeleteDashboardSnapshot(ctx, &dashboardsnapshots.DeleteDashboardSnapshotCommand{
		DeleteKey: snap.DeleteKey,
	})
	if err != nil {
		return nil, false, err
	}
	return nil, true, nil
}

func (s *SnapshotLegacyStore) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	// Handle spec.deleteKey field selector: look up by deleteKey via the service
	if options.FieldSelector != nil {
		if deleteKey, found := options.FieldSelector.RequiresExactMatch("spec.deleteKey"); found {
			snap, err := s.Service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{
				DeleteKey: deleteKey,
			})
			if err != nil {
				return &dashV0.SnapshotList{}, nil
			}
			// Lookups by deleteKey are global; scope the result to the caller's org so
			// this branch (used by the delete-by-key route) cannot resolve a snapshot
			// owned by another org.
			ns, err := request.NamespaceInfoFrom(ctx, true)
			if err != nil {
				return nil, err
			}
			if snap.OrgID != ns.OrgID {
				return &dashV0.SnapshotList{}, nil
			}
			return &dashV0.SnapshotList{
				Items: []dashV0.Snapshot{*convertSnapshotToK8sResource(snap, s.Namespacer)},
			}, nil
		}
	}

	if options.FieldSelector != nil {
		if name, found := options.FieldSelector.RequiresExactMatch("metadata.name"); found {
			snap, err := s.Service.GetDashboardSnapshot(ctx, &dashboardsnapshots.GetDashboardSnapshotQuery{Key: name})
			if errors.Is(err, dashboardsnapshots.ErrBaseNotFound) || apierrors.IsNotFound(err) {
				return &dashV0.SnapshotList{}, nil
			}
			if err != nil {
				return nil, err
			}
			if snap == nil {
				return &dashV0.SnapshotList{}, nil
			}
			item := convertSnapshotToK8sResource(snap, s.Namespacer)
			// Public key resolution lists across namespaces; ordinary LIST stays org-scoped.
			namespace := k8srequest.NamespaceValue(ctx)
			if (namespace != "" && item.Namespace != namespace) || !options.FieldSelector.Matches(SnapshotToSelectableFields(item)) {
				return &dashV0.SnapshotList{}, nil
			}
			return &dashV0.SnapshotList{Items: []dashV0.Snapshot{*item}}, nil
		}
	}

	orgId, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	limit := options.Limit
	if limit < 1 {
		limit = 1000
	}

	searchQuery := dashboardsnapshots.GetDashboardSnapshotsQuery{
		Name:         "", // TODO: Should we support searching by name? In the levacy api is a string query param called query
		Limit:        int(limit),
		OrgID:        orgId,
		SignedInUser: requester,
	}

	res, err := s.Service.SearchDashboardSnapshots(ctx, &searchQuery)
	if err != nil {
		return nil, err
	}

	list := &dashV0.SnapshotList{}
	//convert
	for idx := range res {
		list.Items = append(list.Items, *convertSnapshotDTOToK8sResource(res[idx], s.Namespacer))
	}
	return list, nil
}

func (s *SnapshotLegacyStore) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	query := dashboardsnapshots.GetDashboardSnapshotQuery{
		Key: name,
	}

	res, err := s.Service.GetDashboardSnapshot(ctx, &query)
	if err != nil {
		return nil, err
	}

	if res != nil {
		return convertSnapshotToK8sResource(res, s.Namespacer), nil
	}
	return nil, s.ResourceInfo.NewNotFound(name)
}

// Create implements rest.Creater
func (s *SnapshotLegacyStore) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, options *metav1.CreateOptions) (runtime.Object, error) {
	snap, ok := obj.(*dashV0.Snapshot)
	if !ok {
		return nil, fmt.Errorf("expected Snapshot object, got %T", obj)
	}

	// Run validation if provided
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	// Get user identity from context
	requester, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get requester: %w", err)
	}

	userID, err := requester.GetInternalID()
	if err != nil {
		return nil, fmt.Errorf("failed to get user ID: %w", err)
	}

	// Convert K8s resource to service command
	cmd := convertK8sResourceToCreateCommand(snap, requester.GetOrgID(), userID)

	// Create the snapshot via service
	result, err := s.Service.CreateDashboardSnapshot(ctx, cmd)
	if err != nil {
		return nil, err
	}

	// The legacy service encrypts the dashboard and returns an empty inline value.
	// Preserve the input on the result so the dual writer can copy it to unified storage.
	created := convertSnapshotToK8sResource(result, s.Namespacer)
	created.Spec.Dashboard = snap.Spec.Dashboard
	return created, nil
}

// Update implements rest.Updater - snapshots are immutable, so this returns an error
func (s *SnapshotLegacyStore) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, forceAllowCreate bool, options *metav1.UpdateOptions) (runtime.Object, bool, error) {
	return nil, false, fmt.Errorf("snapshots are immutable and cannot be updated")
}
