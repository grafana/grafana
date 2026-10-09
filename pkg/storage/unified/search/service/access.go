package service

import (
	"context"
	"errors"
	"fmt"

	resourcestorage "github.com/grafana/grafana/pkg/storage/unified/resource"
	resourcecontract "github.com/grafana/grafana/pkg/storage/unified/resource/contract"

	"github.com/grafana/authlib/authz"
	apierrors "k8s.io/apimachinery/pkg/api/errors"

	claims "github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/dashboards/dashboardaccess"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// Check before scanning so an empty index cannot hide a missing service grant.
func (s *searchServer) checkSearchServicePermissions(ctx context.Context, req *resourcepb.ResourceSearchRequest) error {
	id, ok := claims.AuthInfoFrom(ctx)
	if !ok || id == nil {
		if s.access == nil {
			return nil
		}
		return apierrors.NewUnauthorized(authz.ErrMissingAuthInfo.Error())
	}
	key := req.Options.Key
	if !claims.NamespaceMatches(id.GetNamespace(), key.Namespace) {
		return claims.ErrNamespaceMismatch
	}

	verb := utils.VerbGet
	if req.Permission == int64(dashboardaccess.PERMISSION_EDIT) {
		verb = utils.VerbUpdate
	}
	if req.IsDeleted {
		verb = utils.VerbSetPermissions
	}
	resources := indexSources(resourcecontract.NamespacedResource{Namespace: key.Namespace, Group: key.Group, Resource: key.Resource})
	for _, resource := range resources {
		if err := s.checkSearchServicePermission(ctx, id, resource.Group, resource.Resource, verb); err != nil {
			return err
		}
	}
	for _, resource := range req.Federated {
		if err := s.checkSearchServicePermission(ctx, id, resource.Group, resource.Resource, utils.VerbGet); err != nil {
			return err
		}
	}
	return nil
}

func (s *searchServer) checkSearchServicePermission(ctx context.Context, id claims.AuthInfo, group, resource, verb string) error {
	err := resourcestorage.CheckServiceTokenPermissions(id, group, resource, verb)
	if err == nil {
		return nil
	}
	mode := "direct"
	if errors.Is(err, resourcestorage.ErrServiceCannotDelegate) {
		mode = "delegated"
	}
	if access, ok := s.access.(interface{ IsCompatibleWithRBAC(string, string) bool }); ok && !access.IsCompatibleWithRBAC(group, resource) {
		s.indexMetrics.SearchServicePermissionExemptions.WithLabelValues(group, resource, mode).Inc()
		return nil
	}
	s.indexMetrics.SearchServicePermissionFailures.WithLabelValues(mode).Inc()
	s.log.FromContext(ctx).Error("Search service permission check failed", "error", err,
		"group", group, "resource", resource, "verb", verb, "subject", id.GetSubject(),
		"required_permission", fmt.Sprintf("%s/%s:%s", group, resource, verb))
	return err
}
