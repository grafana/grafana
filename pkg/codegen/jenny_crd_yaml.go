package codegen

import (
	"bytes"
	"fmt"
	"path/filepath"

	"cuelang.org/go/cue"
	"cuelang.org/go/cue/ast"
	"cuelang.org/go/encoding/openapi"
	cueyaml "cuelang.org/go/pkg/encoding/yaml"
	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/services/k8s/crd"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
	goyaml "gopkg.in/yaml.v3"
)

// TODO this jenny is quite sloppy, having been quickly adapted from app-sdk. It needs love

// YamlCRDJenny generates a representation of a core structured kind in YAML CRD form.
func YamlCRDJenny(path string) OneToOne {
	return yamlCRDJenny{
		parentpath: path,
	}
}

type yamlCRDJenny struct {
	parentpath string
}

func (yamlCRDJenny) JennyName() string {
	return "YamlCRDJenny"
}

func (j yamlCRDJenny) Generate(k kindsys.Kind) (*codejen.File, error) {
	kind, is := k.(kindsys.Core)
	if !is {
		return nil, nil
	}

	props := kind.Def().Properties
	lin := kind.Lineage()

	// We need to go through every schema, as they all have to be defined in the CRD
	sch, err := lin.Schema(thema.SV(0, 0))
	if err != nil {
		return nil, err
	}

	resource := customResourceDefinition{
		APIVersion: "apiextensions.k8s.io/v1",
		Kind:       "CustomResourceDefinition",
		Metadata: customResourceDefinitionMetadata{
			Name: fmt.Sprintf("%s.%s", props.PluralMachineName, props.CRD.Group),
		},
		Spec: crd.CustomResourceDefinitionSpec{
			Group: props.CRD.Group,
			Scope: props.CRD.Scope,
			Names: crd.CustomResourceDefinitionSpecNames{
				Kind:   props.Name,
				Plural: props.PluralMachineName,
			},
			Versions: make([]crd.CustomResourceDefinitionSpecVersion, 0),
		},
	}
	latest := lin.Latest().Version()

	for sch != nil {
		oapi, err := generateOpenAPI(sch, props)
		if err != nil {
			return nil, err
		}

		vstr := versionString(sch.Version())
		if props.Maturity.Less(kindsys.MaturityStable) {
			vstr = "v0-0alpha1"
		}

		ver, err := valueToCRDSpecVersion(oapi, vstr, sch.Version() == latest)
		if err != nil {
			return nil, err
		}
		if props.CRD.DummySchema {
			ver.Schema = map[string]any{
				"openAPIV3Schema": map[string]any{
					"type": "object",
					"properties": map[string]any{
						"spec": map[string]any{
							"type":                                 "object",
							"x-kubernetes-preserve-unknown-fields": true,
						},
					},
					"required": []any{
						"spec",
					},
				},
			}
		}

		resource.Spec.Versions = append(resource.Spec.Versions, ver)
		sch = sch.Successor()
	}
	contents, err := goyaml.Marshal(resource)
	if err != nil {
		return nil, err
	}
	if props.CRD.DummySchema {
		// Add a comment header for those with dummy schema
		b := new(bytes.Buffer)
		fmt.Fprintf(b, "# This CRD is generated with an empty schema body because Grafana's\n# code generators currently produce OpenAPI that Kubernetes will not\n# accept, despite being valid.\n\n%s", string(contents))
		contents = b.Bytes()
	}

	return codejen.NewFile(filepath.Join(j.parentpath, props.MachineName, props.MachineName+".crd.yml"), contents, j), nil
}

// customResourceDefinition differs from crd.CustomResourceDefinition in that it doesn't use the metav1
// TypeMeta and ObjectMeta, as those do not contain YAML tags and get improperly serialized to YAML.
// Since we don't need to use it with the kubernetes go-client, we don't need the extra functionality attached.
//
//nolint:lll
type customResourceDefinition struct {
	Kind       string                           `json:"kind,omitempty" yaml:"kind,omitempty" protobuf:"bytes,1,opt,name=kind"`
	APIVersion string                           `json:"apiVersion,omitempty" yaml:"apiVersion,omitempty" protobuf:"bytes,2,opt,name=apiVersion"`
	Metadata   customResourceDefinitionMetadata `json:"metadata,omitempty" yaml:"metadata,omitempty"`
	Spec       crd.CustomResourceDefinitionSpec `json:"spec"`
}

type customResourceDefinitionMetadata struct {
	Name string `json:"name,omitempty" yaml:"name" protobuf:"bytes,1,opt,name=name"`
	// TODO: other fields as necessary for codegen
}

type cueOpenAPIEncoded struct {
	Components cueOpenAPIEncodedComponents `json:"components"`
}

type cueOpenAPIEncodedComponents struct {
	Schemas map[string]any `json:"schemas"`
}

func valueToCRDSpecVersion(str string, name string, stored bool) (crd.CustomResourceDefinitionSpecVersion, error) {
	// Decode the bytes back into an object where we can trim the openAPI clutter out
	// and grab just the schema as a map[string]any (which is what k8s wants)
	back := cueOpenAPIEncoded{}
	err := goyaml.Unmarshal([]byte(str), &back)
	if err != nil {
		return crd.CustomResourceDefinitionSpecVersion{}, err
	}
	if len(back.Components.Schemas) != 1 {
		// There should only be one schema here...
		// TODO: this may change with subresources--but subresources should have defined names
		return crd.CustomResourceDefinitionSpecVersion{}, fmt.Errorf("version %s has multiple schemas", name)
	}
	var def map[string]any
	for _, v := range back.Components.Schemas {
		ok := false
		def, ok = v.(map[string]any)
		if !ok {
			return crd.CustomResourceDefinitionSpecVersion{},
				fmt.Errorf("error generating openapi schema - generated schema has invalid type")
		}
	}

	return crd.CustomResourceDefinitionSpecVersion{
		Name:    name,
		Served:  true,
		Storage: stored,
		Schema: map[string]any{
			"openAPIV3Schema": map[string]any{
				"properties": map[string]any{
					"spec": def,
				},
				"required": []any{
					"spec",
				},
				"type": "object",
			},
		},
	}, nil
}

func versionString(version thema.SyntacticVersion) string {
	return fmt.Sprintf("v%d-%d", version[0], version[1])
}

// Hoisting this out of thema until we resolve the proper approach there
func generateOpenAPI(sch thema.Schema, props kindsys.CoreProperties) (string, error) {
	ctx := sch.Underlying().Context()
	v := ctx.CompileString(fmt.Sprintf("#%s: _", props.Name))
	defpath := cue.MakePath(cue.Def(props.Name))
	defsch := v.FillPath(defpath, sch.Underlying())

	cfg := &openapi.Config{
		NameFunc: func(v cue.Value, path cue.Path) string {
			if path.String() == defpath.String() {
				return props.Name
			}
			return ""
		},
		Info: ast.NewStruct( // doesn't matter, we're throwing it away
			"title", ast.NewString(props.Name),
			"version", ast.NewString("0.0"),
		),
	}

	f, err := openapi.Generate(defsch, cfg)
	if err != nil {
		return "", err
	}

	return cueyaml.Marshal(sch.Lineage().Runtime().Context().BuildFile(f))
}
