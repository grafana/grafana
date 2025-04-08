package apistore

import (
	"context"

	dashboardv1alpha1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resource"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

type LargeObjectSupportFake struct {
	threshold     int
	deconstructed bool
	reconstructed bool
}

func (s *LargeObjectSupportFake) GroupResource() schema.GroupResource {
	return dashboardv1alpha1.DashboardResourceInfo.GroupResource()
}

func (s *LargeObjectSupportFake) Threshold() int {
	return s.threshold
}

func (s *LargeObjectSupportFake) MaxSize() int {
	return 10 * 1024 * 1024
}

func (s *LargeObjectSupportFake) Deconstruct(ctx context.Context, key *resource.ResourceKey, client resource.BlobStoreClient, obj utils.GrafanaMetaAccessor, raw []byte) error {
	s.deconstructed = true
	return nil
}

func (s *LargeObjectSupportFake) Reconstruct(ctx context.Context, key *resource.ResourceKey, client resource.BlobStoreClient, obj utils.GrafanaMetaAccessor) error {
	s.reconstructed = true
	return nil
}
