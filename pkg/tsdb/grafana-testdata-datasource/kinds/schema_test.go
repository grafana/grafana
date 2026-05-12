package kinds

import (
	"path/filepath"
	"reflect"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/kube-openapi/pkg/spec3"
	"k8s.io/kube-openapi/pkg/validation/spec"

	sdkapi "github.com/grafana/grafana-plugin-sdk-go/experimental/apis/datasource/v0alpha1"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/pluginschema"
	"github.com/grafana/grafana-plugin-sdk-go/experimental/schemabuilder"
)

func TestPluginSchema(t *testing.T) {
	const pluginDirectory = "../../../../public/app/plugins/datasource/grafana-testdata-datasource/"

	builder, err := schemabuilder.NewSchemaBuilder(
		schemabuilder.BuilderOptions{
			PluginID: []string{"grafana-testdata-datasource", "testdata"},
			ScanCode: []schemabuilder.CodePaths{{
				BasePackage: "github.com/grafana/grafana/pkg/tsdb/grafana-testdata-datasource/kinds",
				CodePath:    "./",
			}},
			Enums: []reflect.Type{
				reflect.TypeFor[NodesQueryType](),
				reflect.TypeFor[StreamingQueryType](),
				reflect.TypeFor[ErrorType](),
				reflect.TypeFor[ErrorSource](),
				reflect.TypeFor[TestDataQueryType](),
			},
		})
	require.NoError(t, err)
	err = builder.AddQueries([]schemabuilder.QueryTypeInfo{{
		Name:   "default",
		GoType: reflect.TypeFor[*TestDataQuery](),
		Examples: []sdkapi.QueryExample{{
			Name: "simple random walk",
			SaveModel: sdkapi.AsUnstructured(
				TestDataQuery{
					ScenarioId: TestDataQueryTypeRandomWalk,
				},
			),
		}, {
			Name: "pulse wave example",
			SaveModel: sdkapi.AsUnstructured(
				TestDataQuery{
					ScenarioId: TestDataQueryTypePredictablePulse,
					PulseWave: &PulseWaveQuery{
						TimeStep: int64(1000),
						OnCount:  10,
						OffCount: 20,
						OffValue: 1.23, // should be any (rather json any)
						OnValue:  4.56, // should be any
					},
				},
			),
		}, {
			Name: "multiple series",
			SaveModel: sdkapi.AsUnstructured(
				TestDataQuery{
					ScenarioId:  TestDataQueryTypeRandomWalk,
					SeriesCount: 10,
					Spread:      0.2,
				},
			),
		}},
	}})
	require.NoError(t, err)

	err = builder.ConfigureSettings(Settings(), SettingsExamples())
	require.NoError(t, err)

	err = builder.SetRoutes(Routes())
	require.NoError(t, err)

	builder.UpdateProviderFiles(t, "v0alpha1", filepath.Join(pluginDirectory, "schema"))
}

func Settings() *pluginschema.Settings {
	v := &pluginschema.Settings{
		Spec:         &spec.Schema{},
		SecureValues: nil, // none
	}

	// Dummy spec
	p := v.Spec
	p.Description = "Test data does not require any explicit configuration"
	p.Required = []string{"title"}
	p.AdditionalProperties = &spec.SchemaOrBool{Allows: false}
	p.Properties = map[string]spec.Schema{
		"title": *spec.StringProperty().
			WithDescription("display name"),
		"url": *spec.StringProperty().
			WithDescription("not used").
			WithExample("http://xxxx"),
	}

	return v
}

func SettingsExamples() *pluginschema.SettingsExamples {
	return &pluginschema.SettingsExamples{
		Examples: map[string]*spec3.Example{
			"": { // empty is the default one displayed in swagger
				ExampleProps: spec3.ExampleProps{
					Summary: "Empty testdata",
					Value: map[string]any{
						"kind": "DataSource",
						"metadata": map[string]any{
							"name": "my-testdata-datasource",
						},
						"spec": map[string]any{
							"title": "My TestData Datasource",
						},
					},
				},
			},
			"with-url": {
				ExampleProps: spec3.ExampleProps{
					Summary: "Testdata with URL (not used)",
					Value: map[string]any{
						"kind": "DataSource",
						"metadata": map[string]any{
							"name": "testdata-with-url",
						},
						"spec": map[string]any{
							"title": "TestData with URL",
							"url":   "http://example.com",
						},
					},
				},
			},
		},
	}
}
