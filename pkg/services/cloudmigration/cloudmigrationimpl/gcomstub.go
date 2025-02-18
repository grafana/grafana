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

func (client *gcomStub) GetPlugins(ctx context.Context, requestID string) (map[string]gcom.Plugin, error) {
	plugins := map[string]gcom.Plugin{
		"plugin-external-valid-grafana": {
			Slug:          "plugin-external-valid-grafana",
			Status:        "active",
			SignatureType: "grafana",
		},
		"plugin-external-valid-commercial": {
			Slug:          "plugin-external-valid-commercial",
			Status:        "active",
			SignatureType: "commercial",
		},
		"plugin-external-valid-community": {
			Slug:          "active-plugin",
			Status:        "active",
			SignatureType: "community",
		},
	}
	return plugins, nil
}
