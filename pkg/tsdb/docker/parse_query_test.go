package docker

import (
	"encoding/json"
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
)

func TestParseQuery(t *testing.T) {
	tests := []struct {
		name       string
		json       string
		wantType   string
		wantContID string
		wantErr    bool
	}{
		{
			name:       "valid container stats",
			json:       `{"resourceType":"container_stats","containerId":"abc123"}`,
			wantType:   ResourceTypeContainerStats,
			wantContID: "abc123",
		},
		{
			name:     "valid system df",
			json:     `{"resourceType":"system_df"}`,
			wantType: ResourceTypeSystemDF,
		},
        {
            name:     "valid all containers info",
            json:     `{"resourceType":"all_containers_info"}`,
            wantType: ResourceTypeAllContainersInfo,
        },
		{
			name:    "container stats missing id",
			json:    `{"resourceType":"container_stats"}`,
			wantErr: true,
		},
		{
			name:    "unknown resource type",
			json:    `{"resourceType":"bogus"}`,
			wantErr: true,
		},
		{
			name:    "malformed json",
			json:    `{not json`,
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			dq := backend.DataQuery{JSON: json.RawMessage(tt.json)}
			got, err := parseQuery(dq)

			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error, got nil")
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if got.ResourceType != tt.wantType {
				t.Errorf("resourceType: got %q, want %q", got.ResourceType, tt.wantType)
			}
			if got.ContainerID != tt.wantContID {
				t.Errorf("containerId: got %q, want %q", got.ContainerID, tt.wantContID)
			}
		})
	}
}
