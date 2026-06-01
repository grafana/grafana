package docker

import (
	"testing"
)

func TestConvertSystemDF(t *testing.T) {
	input := &SystemDF{
		ImageUsage:      DFUsage{ActiveCount: 2, TotalCount: 5, Reclaimable: 100, TotalSize: 500},
		ContainerUsage:  DFUsage{ActiveCount: 1, TotalCount: 3, Reclaimable: 50, TotalSize: 200},
		VolumeUsage:     DFUsage{ActiveCount: 0, TotalCount: 1, Reclaimable: 10, TotalSize: 10},
		BuildCacheUsage: DFUsage{ActiveCount: 0, TotalCount: 0, Reclaimable: 0, TotalSize: 0},
	}

	frame, err := convertSystemDF(input)
	if err != nil {
		t.Fatalf("convertSystemDF: %v", err)
	}
	if frame.Name != "system_df" {
		t.Errorf("frame name: got %q, want system_df", frame.Name)
	}

	categoryField := frame.Fields[0]
	if categoryField.Len() != 4 {
		t.Errorf("expected 4 rows, got %d", categoryField.Len())
	}
	if got := frame.Fields[1].At(0); got != int64(2) {
		t.Errorf("images active_count: got %v, want 2", got)
	}
	if got := frame.Fields[4].At(0); got != int64(500) {
		t.Errorf("images total_size: got %v, want 500", got)
	}
}


func TestConvertContainerStats(t *testing.T) {
	input := &ContainerStats{}

	frame, err := convertContainerStats(input)
	if err != nil {
		t.Fatalf("convertContainerStats: %v", err)
	}
	if frame.Name != "container_stats" {
		t.Errorf("frame name: got %q, want container_stats", frame.Name)
	}
}


func TestConvertAllContainersInfo(t *testing.T) {
    input := &AllContainersInfo{
        Items: []ContainerSummary{
            {
                Names:  []string{"/web-server"},
                State:  "running",
                Status: "Up 45 minutes",
                Image:  "nginx:alpine",
                Ports: []Port{
                    {IP: "0.0.0.0", PrivatePort: 80, PublicPort: 8080, Type: "tcp"},
                },
            },
        },
    }

    frame, err := convertAllContainersInfo(input)
    if err != nil {
        t.Fatalf("convertAllContainersInfo unexpected error: %v", err)
    }
    if frame.Name != "containers" {
        t.Errorf("frame name: got %q, want containers", frame.Name)
    }

    if len(frame.Fields) == 0 {
        t.Error("expected fields in data frame, got 0")
    }
}
