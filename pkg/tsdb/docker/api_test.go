package docker

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana-plugin-sdk-go/backend/log"
	"github.com/moby/moby/client"
)

func testLogger() log.Logger {
	return backend.NewLoggerWith("logger", "test")
}

func TestGetContainerStats(t *testing.T) {
	t.Run("parses a valid stats response", func(t *testing.T) {
		body := `{"cpu_stats":{"cpu_usage":{"total_usage":1000000},"online_cpus":4},"memory_stats":{"usage":2048,"limit":8192}}`
		fake := &fakeDockerClient{
			statsResult: client.ContainerStatsResult{
				Body: io.NopCloser(strings.NewReader(body)),
			},
		}
		api := &DockerAPI{cli: fake, host: "test", log: testLogger()}

		stats, err := api.getContainerStats(context.Background(), "abc123")
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if stats.CPUStats.CPUUsage.TotalUsage != 1000000 {
			t.Errorf("total_usage: got %d, want 1000000", stats.CPUStats.CPUUsage.TotalUsage)
		}
		if stats.MemoryStats.Usage != 2048 {
			t.Errorf("memory usage: got %d, want 2048", stats.MemoryStats.Usage)
		}
	})

	t.Run("empty containerID returns error", func(t *testing.T) {
		api := &DockerAPI{cli: &fakeDockerClient{}, host: "test", log: testLogger()}
		_, err := api.getContainerStats(context.Background(), "")
		if err == nil {
			t.Fatal("expected error for empty containerID, got nil")
		}
	})

	t.Run("SDK error is classified as downstream", func(t *testing.T) {
		fake := &fakeDockerClient{statsErr: errors.New("daemon unreachable")}
		api := &DockerAPI{cli: fake, host: "test", log: testLogger()}

		_, err := api.getContainerStats(context.Background(), "abc123")
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !backend.IsDownstreamError(err) {
			t.Errorf("expected downstream error, got %v", err)
		}
	})

	t.Run("malformed JSON returns error", func(t *testing.T) {
        body := `{"cpu_stats": {` 
        
        fake := &fakeDockerClient{
            statsResult: client.ContainerStatsResult{
                Body: io.NopCloser(strings.NewReader(body)),
            },
        }
        api := &DockerAPI{cli: fake, host: "test", log: testLogger()}

        _, err := api.getContainerStats(context.Background(), "abc123")
        if err == nil {
            t.Fatal("expected error for malformed JSON, got nil")
        }
    })
}

func TestGetSystemDF(t *testing.T) {
	t.Run("SDK error is classified as downstream", func(t *testing.T) {
		fake := &fakeDockerClient{diskErr: errors.New("daemon down")}
		api := &DockerAPI{cli: fake, host: "test", log: testLogger()}

		_, err := api.getSystemDF(context.Background())
		if err == nil {
			t.Fatal("expected error, got nil")
		}
		if !backend.IsDownstreamError(err) {
			t.Errorf("expected downstream error, got %v", err)
		}
	})
}

func TestDataQuery(t *testing.T) {
	t.Run("unknown resource type returns downstream error", func(t *testing.T) {
		api := &DockerAPI{cli: &fakeDockerClient{}, host: "test", log: testLogger()}
		_, err := api.DataQuery(context.Background(), DockerQuery{ResourceType: "bogus"})
		if err == nil {
			t.Fatal("expected error for unknown resource type, got nil")
		}
		if !backend.IsDownstreamError(err) {
			t.Errorf("expected downstream error, got %v", err)
		}
	})
    
    t.Run("valid system_df query routes successfully", func(t *testing.T) {
        fake := &fakeDockerClient{
            diskUsage: client.DiskUsageResult{}, // Mocking the backend dependency
        }
        api := &DockerAPI{cli: fake, host: "test", log: testLogger()}

        _, err := api.DataQuery(context.Background(), DockerQuery{ResourceType: ResourceTypeSystemDF})
        if err != nil {
            t.Fatalf("expected no error for valid system_df query, got: %v", err)
        }
    })
}
