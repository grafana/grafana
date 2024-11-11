package cloudmigrationimpl

import (
	"context"
	"fmt"
	"strconv"

	"github.com/grafana/grafana/pkg/services/gcom"
)

type gcomStub struct {
}

func (client *gcomStub) GetInstanceByID(_ context.Context, _ string, instanceID string) (gcom.Instance, error) {
	id, err := strconv.Atoi(instanceID)
	if err != nil {
		return gcom.Instance{}, fmt.Errorf("parsing instanceID: %w", err)
	}
	return gcom.Instance{
		ID:          id,
		Slug:        "stubinstance",
		RegionSlug:  "fake-region",
		ClusterSlug: "fake-cluser",
	}, nil
}
