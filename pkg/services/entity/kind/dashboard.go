package kind

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
)

type DashboardEntity struct {
	entity.Envelope

	// TODO: should be the real dashboard interface
	Body interface{} `json:"body,omitempty"`
}

var _ entity.Kind = &DashboardKind{}

type DashboardKind struct{}

func (k *DashboardKind) Info() entity.KindInfo {
	return entity.KindInfo{
		ID:          "dashboard",
		Description: "Core dashboard model",
		PathSuffix:  "-dash.json",
	}
}

func (k *DashboardKind) GoType() interface{} {
	return &DashboardEntity{}
}

func (k *DashboardKind) Read(payload []byte) (interface{}, error) {
	g := &DashboardEntity{}
	err := json.Unmarshal(payload, g)
	if err != nil {
		return nil, err
	}
	if g.Kind == "" {
		g.Kind = "dashboard"
	} else if g.Kind != "dashboard" {
		return nil, fmt.Errorf("expected kind: %s", "dashboard")
	}
	return g, nil
}

func (k *DashboardKind) Write(v interface{}) ([]byte, error) {
	g, ok := v.(*DashboardEntity)
	if !ok {
		return nil, fmt.Errorf("expected RawFileEntity")
	}
	return json.MarshalIndent(g, "", "  ")
}

func (k *DashboardKind) GetReferences(v interface{}) []entity.EntityLocator {
	return nil // TODO:
}

func (k *DashboardKind) Normalize(payload []byte, details bool) entity.NormalizeResponse {
	_, err := k.Read(payload)
	if err != nil {
		return entity.NormalizeResponse{
			Valid: false,
			Info: []data.Notice{
				{
					Severity: data.NoticeSeverityError,
					Text:     err.Error(),
				},
			},
		}
	}
	return entity.NormalizeResponse{
		Valid:  true,
		Result: payload,
	}
}

func (k *DashboardKind) Migrate(payload []byte, targetVersion string) entity.NormalizeResponse {
	return k.Normalize(payload, false) // migration is a noop
}

func (k *DashboardKind) GetSchemaVersions() []string {
	return nil
}

func (k *DashboardKind) GetJSONSchema(schemaVersion string) []byte {
	// The payload is not json!
	return nil
}
