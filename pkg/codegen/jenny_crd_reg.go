package codegen

import (
	"bytes"
	"encoding/json"
	"fmt"
	"path/filepath"

	"github.com/grafana/codejen"
	kindsv1 "github.com/grafana/grafana-apiserver/pkg/apis/kinds/v1"
	"github.com/grafana/kindsys"
	"github.com/grafana/thema"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// CRDKindRegistryJenny generates a static registry of the CRD representations
// of core Grafana kinds, layered on top of the publicly consumable generated
// registry in pkg/corekinds.
//
// Path should be the relative path to the directory that will contain the
// generated registry.
func CRDKindRegistryJenny(path string) ManyToOne {
	return &crdregjenny{
		path: path,
	}
}

type crdregjenny struct {
	path string
}

func (j *crdregjenny) JennyName() string {
	return "CRDKindRegistryJenny"
}

func (j *crdregjenny) Generate(kinds ...kindsys.Kind) (*codejen.File, error) {
	cores := make([]kindsys.Core, 0, len(kinds))
	grds := make([][]byte, 0, len(kinds))
	for _, d := range kinds {
		if corekind, is := d.(kindsys.Core); is {
			cores = append(cores, corekind)
			grd, err := j.generateJSON(corekind)
			if err != nil {
				return nil, err
			}
			grds = append(grds, grd)
		}
	}
	if len(cores) == 0 {
		return nil, nil
	}

	buf := new(bytes.Buffer)
	if err := tmpls.Lookup("core_crd_registry.tmpl").Execute(buf, tvars_kind_registry{
		PackageName:       "corecrd",
		KindPackagePrefix: filepath.ToSlash("github.com/grafana/grafana/pkg/services/k8s/resources"),
		Kinds:             cores,
	}); err != nil {
		return nil, fmt.Errorf("failed executing core crd registry template: %w", err)
	}

	b, err := postprocessGoFile(genGoFile{
		path: j.path,
		in:   buf.Bytes(),
	})
	if err != nil {
		return nil, err
	}

	return codejen.NewFile(filepath.Join(j.path, "registry_gen.go"), b, j), nil
}

func (j *crdregjenny) generateJSON(k kindsys.Kind) ([]byte, error) {
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

	resource := kindsv1.GrafanaResourceDefinition{
		ObjectMeta: metav1.ObjectMeta{
			Name: fmt.Sprintf("%s.%s", props.PluralMachineName, props.CRD.Group),
		},
		Spec: kindsv1.GrafanaResourceDefinitionSpec{
			Group: props.PluralMachineName + ".kinds.grafana.com",
			Scope: "Namespaced",
			Names: kindsv1.GrafanaResourceDefinitionNames{
				Kind:   props.Name,
				Plural: props.PluralMachineName,
			},
			Versions: make([]kindsv1.GrafanaResourceDefinitionVersion, 0),
		},
	}
	latest := lin.Latest().Version()

	for sch != nil {
		vstr := versionString(sch.Version())
		if props.Maturity.Less(kindsys.MaturityStable) {
			vstr = "v0-0alpha1"
		}

		ver := kindsv1.GrafanaResourceDefinitionVersion{
			Name:       vstr,
			Served:     true,
			Storage:    sch.Version() == latest,
			Deprecated: false,
		}

		resource.Spec.Versions = append(resource.Spec.Versions, ver)
		sch = sch.Successor()
	}

	return json.Marshal(resource)
}

func versionString(version thema.SyntacticVersion) string {
	return fmt.Sprintf("v%d-%d", version[0], version[1])
}
