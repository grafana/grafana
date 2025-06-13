package apistore

import (
	"context"

	"k8s.io/apimachinery/pkg/runtime/schema"

	dashboardv1 "github.com/grafana/grafana/apps/dashboard/pkg/apis/dashboard/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

type LargeObjectSupportFake struct {
	threshold     int
	deconstructed bool
	reconstructed bool
}

func (s *LargeObjectSupportFake) GroupResource() schema.GroupResource {
	return dashboardv1.DashboardResourceInfo.GroupResource()
}

func (s *LargeObjectSupportFake) Threshold() int {
	return s.threshold
}

func (s *LargeObjectSupportFake) MaxSize() int {
	return 10 * 1024 * 1024
}

func (s *LargeObjectSupportFake) Deconstruct(_ context.Context, _ *resourcepb.ResourceKey, _ resourcepb.BlobStoreClient, _ utils.GrafanaMetaAccessor, _ []byte) error {
	s.deconstructed = true
	return nil
}

func (s *LargeObjectSupportFake) Reconstruct(_ context.Context, _ *resourcepb.ResourceKey, _ resourcepb.BlobStoreClient, _ utils.GrafanaMetaAccessor) error {
	s.reconstructed = true
	return nil
}
