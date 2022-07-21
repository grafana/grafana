package kind

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
)

type DataSourceEntity struct {
	entity.EnvelopeWithSecureKeys

	// TODO: should be the real DataSource interface
	Body interface{} `json:"body,omitempty"`
}

var _ entity.Kind = &DataSourceKind{}

type DataSourceKind struct{}

func (k *DataSourceKind) Info() entity.KindInfo {
	return entity.KindInfo{
		ID:            "DataSource",
		FileSuffix:    "-ds.json",
		HasSecureKeys: true,
	}
}

func (k *DataSourceKind) GoType() interface{} {
	return &DataSourceEntity{}
}

func (k *DataSourceKind) Read(payload []byte) (interface{}, error) {
	g := &DataSourceEntity{}
	err := json.Unmarshal(payload, g)
	if err != nil {
		return nil, err
	}
	if g.Kind == "" {
		g.Kind = "DataSource"
	} else if g.Kind != "DataSource" {
		return nil, fmt.Errorf("expected kind: %s", "DataSource")
	}
	return g, nil
}

func (k *DataSourceKind) Write(v interface{}) ([]byte, error) {
	g, ok := v.(*DataSourceEntity)
	if !ok {
		return nil, fmt.Errorf("expected DataSourceEntity")
	}
	return json.MarshalIndent(g, "", "  ")
}

func (k *DataSourceKind) GetReferences(v interface{}) []entity.EntityLocator {
	return nil // TODO?
}

func (k *DataSourceKind) Validate(payload []byte, details bool) entity.ValidationResponse {
	_, err := k.Read(payload)
	if err != nil {
		return entity.ValidationResponse{
			Valid: false,
			Info: []data.Notice{
				{
					Severity: data.NoticeSeverityError,
					Text:     err.Error(),
				},
			},
		}
	}
	return entity.ValidationResponse{
		Valid:  true,
		Result: payload,
	}
}

func (k *DataSourceKind) Migrate(payload []byte, targetVersion string) entity.ValidationResponse {
	return k.Validate(payload, false) // migration is a noop
}

func (k *DataSourceKind) GetSchemaVersions() []string {
	return nil
}

func (k *DataSourceKind) GetJSONSchema(schemaVersion string) []byte {
	// The payload is not json!
	return nil
}
