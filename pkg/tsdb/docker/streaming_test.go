package docker

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/data"
)

func TestSubscribeStream(t *testing.T) {
	t.Run("valid path and containerId returns OK", func(t *testing.T) {
		s := newTestService(&fakeDockerClient{})

		resp, err := s.SubscribeStream(context.Background(), &backend.SubscribeStreamRequest{
			PluginContext: backend.PluginContext{},
			Path:         "stats/abc123hash",
			Data:         json.RawMessage(`{"resourceType":"container_stats","containerId":"abc123"}`),
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.Status != backend.SubscribeStreamStatusOK {
			t.Errorf("status: got %v, want OK", resp.Status)
		}
	})

	t.Run("invalid path returns NotFound", func(t *testing.T) {
		s := newTestService(&fakeDockerClient{})

		resp, err := s.SubscribeStream(context.Background(), &backend.SubscribeStreamRequest{
			PluginContext: backend.PluginContext{},
			Path:         "invalid/path",
			Data:         json.RawMessage(`{"resourceType":"container_stats","containerId":"abc123"}`),
		})
		if err == nil {
			t.Fatal("expected error for invalid path, got nil")
		}
		if resp.Status != backend.SubscribeStreamStatusNotFound {
			t.Errorf("status: got %v, want NotFound", resp.Status)
		}
	})

	t.Run("missing containerId returns NotFound", func(t *testing.T) {
		s := newTestService(&fakeDockerClient{})

		resp, err := s.SubscribeStream(context.Background(), &backend.SubscribeStreamRequest{
			PluginContext: backend.PluginContext{},
			Path:         "stats/somehash",
			Data:         json.RawMessage(`{"resourceType":"container_stats","containerId":""}`),
		})
		if err == nil {
			t.Fatal("expected error for missing containerId, got nil")
		}
		if resp.Status != backend.SubscribeStreamStatusNotFound {
			t.Errorf("status: got %v, want NotFound", resp.Status)
		}
	})

	t.Run("returns cached initial data when stream exists", func(t *testing.T) {
		s := newTestService(&fakeDockerClient{})
		dsInfo, _ := s.getDSInfo(context.Background(), backend.PluginContext{})

		frame := data.NewFrame("container_stats",
			data.NewField("time", nil, []int64{1000}),
			data.NewField("cpu_percent", nil, []float64{25.0}),
		)
		cached, _ := data.FrameToJSONCache(frame)
		dsInfo.streamsMu.Lock()
		dsInfo.streams["stats/abc123hash"] = cached
		dsInfo.streamsMu.Unlock()

		resp, err := s.SubscribeStream(context.Background(), &backend.SubscribeStreamRequest{
			PluginContext: backend.PluginContext{},
			Path:         "stats/abc123hash",
			Data:         json.RawMessage(`{"resourceType":"container_stats","containerId":"abc123"}`),
		})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.Status != backend.SubscribeStreamStatusOK {
			t.Errorf("status: got %v, want OK", resp.Status)
		}
		if resp.InitialData == nil {
			t.Error("expected initial data from cache, got nil")
		}
	})
}

func TestPublishStream(t *testing.T) {
	t.Run("always returns permission denied", func(t *testing.T) {
		s := newTestService(&fakeDockerClient{})
		resp, err := s.PublishStream(context.Background(), &backend.PublishStreamRequest{})
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if resp.Status != backend.PublishStreamStatusPermissionDenied {
			t.Errorf("status: got %v, want PermissionDenied", resp.Status)
		}
	})
}
