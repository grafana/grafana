package docker

import (
	"context"
	"errors"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/instancemgmt"
	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/moby/moby/client"
)

func newTestService(fake dockerClient) *Service {
	logger := backend.NewLoggerWith("logger", "test")
	dsInfo := &datasourceInfo{
		API:     &DockerAPI{cli: fake, host: "test", log: logger},
		streams: make(map[string]data.FrameJSONCache),
	}
	return &Service{
		im:     &fakeInstanceManager{instance: dsInfo},
		logger: logger,
	}
}

type fakeInstanceManager struct {
	instance instancemgmt.Instance
}

func (f *fakeInstanceManager) Get(_ context.Context, _ backend.PluginContext) (instancemgmt.Instance, error) {
	return f.instance, nil
}

func (f *fakeInstanceManager) Do(_ context.Context, _ backend.PluginContext, _ instancemgmt.InstanceCallbackFunc) error {
	return nil
}

func TestCheckHealth(t *testing.T) {
	t.Run("healthy when system_df returns one frame", func(t *testing.T) {
		fake := &fakeDockerClient{
			diskUsage: client.DiskUsageResult{},
		}
		s := newTestService(fake)

		result, err := s.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{},
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if result.Status != backend.HealthStatusOk {
			t.Errorf("status: got %v, want OK. message: %s", result.Status, result.Message)
		}
	})

	t.Run("error status when DiskUsage fails", func(t *testing.T) {
		fake := &fakeDockerClient{diskErr: errors.New("daemon down")}
		s := newTestService(fake)

		result, err := s.CheckHealth(context.Background(), &backend.CheckHealthRequest{
			PluginContext: backend.PluginContext{},
		})
		if err != nil {
			t.Fatalf("CheckHealth returned err (should be nil; error goes in result): %v", err)
		}
		if result.Status != backend.HealthStatusError {
			t.Errorf("status: got %v, want Error", result.Status)
		}
	})
}
