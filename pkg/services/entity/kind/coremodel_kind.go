package kind

import (
	"encoding/json"
	"fmt"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/entity"
	"github.com/grafana/grafana/pkg/framework/coremodel"
	"github.com/grafana/thema"
)

// this should be generic
type CoremodelEntity struct {
	entity.Envelope

	// TODO: generics
	Body interface{} `json:"body,omitempty"`
}

var _ entity.Kind = &CoremodelKind{}

type CoremodelKind struct {
	name        string
	description string
	pathSuffix  string
	coremodel   coremodel.Interface
}

func NewCoremodelKind(
	coremodel coremodel.Interface,
	pathSuffix string,
) *CoremodelKind {
	name := coremodel.Lineage().Name()
	return &CoremodelKind{
		name:        name,
		description: name,
		pathSuffix:  pathSuffix,
		coremodel:   coremodel,
	}
}

func (c *CoremodelKind) Info() entity.KindInfo {
	return entity.KindInfo{
		ID:          c.name,
		Description: c.description,
		PathSuffix:  c.pathSuffix,
	}
}

func (c *CoremodelKind) GoType() interface{} {
	return &CoremodelEntity{}
}

func (c *CoremodelKind) Read(payload []byte) (interface{}, error) {
	output, _, err := coremodel.Mux(c.coremodel).Converge(payload)
	if err != nil {
		return nil, err
	}

	// this should implement envelope
	return output, nil
}

func (c *CoremodelKind) Write(v interface{}) ([]byte, error) {
	g, ok := v.(*CoremodelEntity)
	if !ok {
		return nil, fmt.Errorf("expected RawFileEntity")
	}

	// TODO go type -> JSON -> inputKernel??
	return json.MarshalIndent(g, "", "  ")
}

// entity locator kindId
func (c *CoremodelKind) GetReferences(v interface{}) []entity.EntityLocator {
	return nil // TODO - input generic function
}

func (c *CoremodelKind) Normalize(payload []byte, details bool) entity.NormalizeResponse {
	_, _, err := coremodel.Mux(c.coremodel).Converge(payload)
	if err != nil {
		return entity.NormalizeResponse{
			Valid:  false,
			Result: payload,
			Info: []data.Notice{
				{
					Severity: data.NoticeSeverityError,
					Text:     "validation failed " + err.Error(),
					Link:     "",
					Inspect:  0,
				},
			},
		}
	}

	return entity.NormalizeResponse{
		Valid:  true,
		Result: payload,
	}
}

// todo: do we need to return err from this method ?
func (c *CoremodelKind) Migrate(payload []byte, targetVersion string) entity.NormalizeResponse {
	version, err := thema.ParseSyntacticVersion(targetVersion)
	if err != nil {
		// TODO...
		return entity.NormalizeResponse{
			Valid:  false,
			Result: payload,
		}
	}

	output, _, err := coremodel.Mux(c.coremodel, coremodel.Version(version)).ConvergeJSON(payload)
	if err != nil {
		// TODO..
		return entity.NormalizeResponse{
			Valid:  false,
			Result: payload,
		}
	}

	return entity.NormalizeResponse{
		Valid:  true,
		Result: output,
	}
}

func (c *CoremodelKind) GetSchemaVersions() []string {
	versions := make([]string, 0)

	schema := c.coremodel.CurrentSchema()
	for schema != nil {
		versions = append(versions, schema.Version().String())
		schema = schema.Predecessor()
	}

	return versions
}

func (c *CoremodelKind) GetJSONSchema(schemaVersion string) []byte {
	// TODO
	return nil
}
