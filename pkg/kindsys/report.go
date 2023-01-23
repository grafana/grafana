//go:build ignore
// +build ignore

//go:generate go run report.go

package main

import (
	"context"
	"cuelang.org/go/cue"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"reflect"
	"sort"
	"strings"

	"github.com/grafana/codejen"
	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/grafana/pkg/kindsys/kindsysreport"
	"github.com/grafana/grafana/pkg/plugins/pfs/corelist"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/grafana/pkg/registry/corekind"
	"github.com/grafana/thema"
)

const (
	// Program's output
	reportFileName = "report.json"

	// External references
	repoBaseURL = "https://github.com/grafana/grafana/tree/main"
	docsBaseURL = "https://grafana.com/docs/grafana/next/developers/kinds"

	// Local references
	coreTSPath  = "packages/grafana-schema/src/raw/%s/%s/%s_types.gen.ts"
	coreGoPath  = "pkg/kinds/%s/%s_kind_gen.go"
	coreCUEPath = "kinds/%s/%s_kind.cue"

	composableTSPath  = "public/app/plugins/%s/%s/models.gen.ts"
	composableGoPath  = "pkg/tsdb/%s/types_%s_gen.go"
	composableCUEPath = "public/app/plugins/%s/%s/composable_%s.cue"
)

func main() {
	report := buildKindStateReport()
	reportJSON := elsedie(json.MarshalIndent(report, "", "  "))("error generating json output")

	file := codejen.NewFile(reportFileName, reportJSON, reportJenny{})
	filesystem := elsedie(file.ToFS())("error building in-memory file system")

	if _, set := os.LookupEnv("CODEGEN_VERIFY"); set {
		if err := filesystem.Verify(context.Background(), ""); err != nil {
			die(fmt.Errorf("generated code is out of sync with inputs:\n%s\nrun `make gen-cue` to regenerate", err))
		}
	} else if err := filesystem.Write(context.Background(), ""); err != nil {
		die(fmt.Errorf("error while writing generated code to disk:\n%s", err))
	}
}

// static list of planned core kinds so that we can inject ones that
// haven't been started on yet as "planned"
var plannedCoreKinds = []string{
	"Dashboard",
	"Playlist",
	"Team",
	"User",
	"Folder",
	"DataSource",
	"APIKey",
	"ServiceAccount",
	"Thumb",
	"Query",
	"QueryHistory",
}

type Kind struct {
	kindsys.SomeKindProperties
	Category             string
	SchemaRef            string
	GoRef                string
	TsRef                string
	DocsRef              string
	GrafanaMaturityCount int
}

// MarshalJSON is overwritten to marshal
// kindsys.SomeKindProperties at root level.
func (k Kind) MarshalJSON() ([]byte, error) {
	b, err := json.Marshal(k.SomeKindProperties)
	if err != nil {
		return nil, err
	}

	var m map[string]interface{}
	if err = json.Unmarshal(b, &m); err != nil {
		return nil, err
	}

	m["category"] = k.Category
	m["grafanaMaturityCount"] = k.GrafanaMaturityCount

	for _, ref := range []string{"SchemaRef", "GoRef", "TsRef", "DocsRef"} {
		refVal := reflect.ValueOf(k).FieldByName(ref).String()
		if len(refVal) > 0 {
			m[toCamelCase(ref)] = refVal
		} else {
			m[toCamelCase(ref)] = "n/a"
		}
	}

	return json.Marshal(m)
}

type KindStateReport struct {
	Kinds      map[string]Kind      `json:"kinds"`
	Dimensions map[string]Dimension `json:"dimensions"`
}

func (r *KindStateReport) add(k Kind) {
	kName := k.Common().MachineName

	r.Kinds[kName] = k
	r.Dimensions["maturity"][k.Common().Maturity.String()].add(kName)
	r.Dimensions["category"][k.Category].add(kName)
}

type Dimension map[string]*DimensionValue

type DimensionValue struct {
	Name  string   `json:"name"`
	Items []string `json:"items"`
	Count int      `json:"count"`
}

func (dv *DimensionValue) add(s string) {
	dv.Count++
	dv.Items = append(dv.Items, s)
}

// emptyKindStateReport is used to ensure certain
// dimension values are present (even if empty) in
// the final report.
func emptyKindStateReport() *KindStateReport {
	return &KindStateReport{
		Kinds: make(map[string]Kind),
		Dimensions: map[string]Dimension{
			"maturity": {
				"planned":      emptyDimensionValue("planned"),
				"merged":       emptyDimensionValue("merged"),
				"experimental": emptyDimensionValue("experimental"),
				"stable":       emptyDimensionValue("stable"),
				"mature":       emptyDimensionValue("mature"),
			},
			"category": {
				"core":       emptyDimensionValue("core"),
				"composable": emptyDimensionValue("composable"),
			},
		},
	}
}

func emptyDimensionValue(name string) *DimensionValue {
	return &DimensionValue{
		Name:  name,
		Items: make([]string, 0),
		Count: 0,
	}
}

func buildKindStateReport() *KindStateReport {
	r := emptyKindStateReport()
	b := corekind.NewBase(nil)

	seen := make(map[string]bool)
	for _, k := range b.All() {
		seen[k.Props().Common().Name] = true
		k.Lineage()
		switch k.Props().(type) {
		case kindsys.CoreProperties:
			category := "core"
			commonProps := k.Props().Common()
			r.add(Kind{
				SomeKindProperties:   k.Props(),
				Category:             category,
				GoRef:                buildCoreGoRef(commonProps),
				DocsRef:              buildDocsRef(category, commonProps),
				TsRef:                buildCoreTSRef(k.Lineage(), k.Decl()),
				SchemaRef:            buildCoreSchemaRef(commonProps),
				GrafanaMaturityCount: grafanaMaturityAttrCount(k.Lineage().Latest().Underlying()),
			})
		}
	}

	for _, kn := range plannedCoreKinds {
		if seen[kn] {
			continue
		}

		r.add(Kind{
			SomeKindProperties: kindsys.CoreProperties{
				CommonProperties: kindsys.CommonProperties{
					Name:              kn,
					PluralName:        kn + "s",
					MachineName:       machinize(kn),
					PluralMachineName: machinize(kn) + "s",
					Maturity:          "planned",
				},
			},
			Category: "core",
		})
	}

	all := kindsys.SchemaInterfaces(nil)
	for _, pp := range corelist.New(nil) {
		for _, si := range all {
			category := "composable"
			var goRef string
			if ck, has := pp.ComposableKinds[si.Name()]; has {
				cp := ck.Decl().Properties
				if pp.Properties.Backend != nil && *pp.Properties.Backend {
					goRef = buildComposableGoRef(pp.Properties.Type, cp)
				}
				r.add(Kind{
					SomeKindProperties:   ck.Props(),
					Category:             category,
					GoRef:                goRef,
					DocsRef:              buildDocsRef(category, ck.Props().Common()),
					TsRef:                buildComposableTSRef(pp.Properties.Type, cp),
					SchemaRef:            buildComposableSchemaRef(pp.Properties.Type, cp),
					GrafanaMaturityCount: grafanaMaturityAttrCount(ck.Lineage().Latest().Underlying()),
				})
			} else if may := si.Should(string(pp.Properties.Type)); may {
				n := plugindef.DerivePascalName(pp.Properties) + si.Name()
				ck := kindsys.ComposableProperties{
					SchemaInterface: si.Name(),
					CommonProperties: kindsys.CommonProperties{
						Name:              n,
						PluralName:        n + "s",
						MachineName:       machinize(n),
						PluralMachineName: machinize(n) + "s",
						LineageIsGroup:    si.IsGroup(),
						Maturity:          "planned",
					},
				}
				r.add(Kind{
					SomeKindProperties: ck,
					Category:           category,
					GoRef:              goRef,
				})
			}
		}
	}

	for _, d := range r.Dimensions {
		for _, dv := range d {
			sort.Strings(dv.Items)
		}
	}

	return r
}

func buildDocsRef(category string, props kindsys.CommonProperties) string {
	return path.Join(docsBaseURL, category, props.MachineName, "schema-reference")
}

func buildCoreTSRef(lin thema.Lineage, decl kindsys.Decl[kindsys.CoreProperties]) string {
	vpath := fmt.Sprintf("v%v", lin.Latest().Version()[0])
	if decl.Properties.Common().Maturity.Less(kindsys.MaturityStable) {
		vpath = "x"
	}

	return path.Join(repoBaseURL, fmt.Sprintf(coreTSPath, decl.Properties.MachineName, vpath, decl.Properties.MachineName))
}

func buildComposableTSRef(pType plugindef.Type, cp kindsys.ComposableProperties) string {
	pName := strings.Replace(cp.MachineName, strings.ToLower(cp.SchemaInterface), "", 1)
	return path.Join(repoBaseURL, fmt.Sprintf(composableTSPath, string(pType), pName))
}

func buildCoreGoRef(cp kindsys.CommonProperties) string {
	return path.Join(repoBaseURL, fmt.Sprintf(coreGoPath, cp.MachineName, cp.MachineName))
}

func buildComposableGoRef(pType plugindef.Type, cp kindsys.ComposableProperties) string {
	schemaInterface := strings.ToLower(cp.SchemaInterface)
	pName := strings.Replace(cp.MachineName, schemaInterface, "", 1)
	return path.Join(repoBaseURL, fmt.Sprintf(composableGoPath, pName, schemaInterface))
}

func buildCoreSchemaRef(cp kindsys.CommonProperties) string {
	return path.Join(repoBaseURL, fmt.Sprintf(coreCUEPath, cp.MachineName, cp.MachineName))
}

func buildComposableSchemaRef(pType plugindef.Type, cp kindsys.ComposableProperties) string {
	schemaInterface := strings.ToLower(cp.SchemaInterface)
	pName := strings.Replace(cp.MachineName, schemaInterface, "", 1)
	return path.Join(repoBaseURL, fmt.Sprintf(composableCUEPath, string(pType), pName, schemaInterface))
}

func grafanaMaturityAttrCount(sch cue.Value) int {
	const attr = "grafanamaturity"
	aw := new(kindsysreport.AttributeWalker)
	return aw.Count(sch, attr)[attr]
}

func machinize(s string) string {
	return strings.Map(func(r rune) rune {
		switch {
		case r >= 'a' && r <= 'z':
			fallthrough
		case r >= '0' && r <= '9':
			fallthrough
		case r == '_':
			return r
		case r >= 'A' && r <= 'Z':
			return r + 32
		case r == '-':
			return '_'
		default:
			return -1
		}
	}, s)
}

func toCamelCase(s string) string {
	return strings.ToLower(string(s[0])) + s[1:]
}

type reportJenny struct{}

func (reportJenny) JennyName() string {
	return "ReportJenny"
}

func elsedie[T any](t T, err error) func(msg string) T {
	if err != nil {
		return func(msg string) T {
			fmt.Fprintf(os.Stderr, "%s: %s\n", msg, err)
			os.Exit(1)
			return t
		}
	}

	return func(msg string) T {
		return t
	}
}

func die(err error) {
	fmt.Fprint(os.Stderr, err, "\n")
	os.Exit(1)
}
