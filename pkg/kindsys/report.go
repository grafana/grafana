//go:build ignore
// +build ignore

//go:generate go run report.go

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"

	"cuelang.org/go/cue"

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
	coreGoPath  = "pkg/kinds/%s"
	coreCUEPath = "kinds/%s/%s_kind.cue"

	composableTSPath  = "public/app/plugins/%s/%s/%s.gen.ts"
	composableGoPath  = "pkg/tsdb/%s/kinds/%s/types_%s_gen.go"
	composableCUEPath = "public/app/plugins/%s/%s/%s.cue"
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

type KindLinks struct {
	Schema string
	Go     string
	Ts     string
	Docs   string
}

type Kind struct {
	kindsys.SomeKindProperties
	Category             string
	Links                KindLinks
	GrafanaMaturityCount int
	CodeOwners           []string
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

	if len(k.CodeOwners) == 0 {
		m["codeowners"] = []string{}
	} else {
		m["codeowners"] = k.CodeOwners
	}

	m["links"] = map[string]string{}
	for _, ref := range []string{"Schema", "Go", "Ts", "Docs"} {
		refVal := reflect.ValueOf(k.Links).FieldByName(ref).String()
		if len(refVal) > 0 {
			m["links"].(map[string]string)[toCamelCase(ref)] = refVal
		} else {
			m["links"].(map[string]string)[toCamelCase(ref)] = "n/a"
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

	groot := filepath.Join(elsedie(os.Getwd())("cannot get cwd"), "..", "..")
	of := elsedie(kindsysreport.NewCodeOwnersFinder(groot))("cannot parse .github/codeowners")

	seen := make(map[string]bool)
	for _, k := range b.All() {
		seen[k.Props().Common().Name] = true
		lin := k.Lineage()
		links := buildCoreLinks(lin, k.Def().Properties)
		r.add(Kind{
			SomeKindProperties:   k.Props(),
			Category:             "core",
			Links:                links,
			GrafanaMaturityCount: grafanaMaturityAttrCount(lin.Latest().Underlying()),
			CodeOwners:           findCodeOwners(of, links),
		})
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
			if ck, has := pp.ComposableKinds[si.Name()]; has {
				links := buildComposableLinks(pp.Properties, ck.Def().Properties)
				r.add(Kind{
					SomeKindProperties:   ck.Props(),
					Category:             "composable",
					Links:                links,
					GrafanaMaturityCount: grafanaMaturityAttrCount(ck.Lineage().Latest().Underlying()),
					CodeOwners:           findCodeOwners(of, links),
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
					Category:           "composable",
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

func buildCoreLinks(lin thema.Lineage, cp kindsys.CoreProperties) KindLinks {
	const category = "core"
	vpath := fmt.Sprintf("v%v", lin.Latest().Version()[0])
	if cp.Maturity.Less(kindsys.MaturityStable) {
		vpath = "x"
	}

	return KindLinks{
		Schema: elsedie(url.JoinPath(repoBaseURL, fmt.Sprintf(coreCUEPath, cp.MachineName, cp.MachineName)))("cannot build schema link"),
		Go:     elsedie(url.JoinPath(repoBaseURL, fmt.Sprintf(coreGoPath, cp.MachineName)))("cannot build go link"),
		Ts:     elsedie(url.JoinPath(repoBaseURL, fmt.Sprintf(coreTSPath, cp.MachineName, vpath, cp.MachineName)))("cannot build ts link"),
		Docs:   elsedie(url.JoinPath(docsBaseURL, category, cp.MachineName, "schema-reference"))("cannot build docs link"),
	}
}

// used to map names for those plugins that aren't following
// naming conventions, like 'annonlist' which comes from "Annotations list".
var irregularPluginNames = map[string]string{
	// Panel
	"alertgroups":     "alertGroups",
	"annotationslist": "annolist",
	"dashboardlist":   "dashlist",
	"nodegraph":       "nodeGraph",
	"statetimeline":   "state-timeline",
	"statushistory":   "status-history",
	"tableold":        "table-old",
	// Datasource
	"googlecloudmonitoring": "cloud-monitoring",
	"azuremonitor":          "grafana-azure-monitor-datasource",
	"microsoftsqlserver":    "mssql",
	"postgresql":            "postgres",
}

func buildComposableLinks(pp plugindef.PluginDef, cp kindsys.ComposableProperties) KindLinks {
	const category = "composable"
	schemaInterface := strings.ToLower(cp.SchemaInterface)

	pName := strings.Replace(cp.MachineName, schemaInterface, "", 1)
	if irr, ok := irregularPluginNames[pName]; ok {
		pName = irr
	}

	var goLink string
	if pp.Backend != nil && *pp.Backend {
		goLink = elsedie(url.JoinPath(repoBaseURL, fmt.Sprintf(composableGoPath, pName, schemaInterface, schemaInterface)))("cannot build go link")
	}

	return KindLinks{
		Schema: elsedie(url.JoinPath(repoBaseURL, fmt.Sprintf(composableCUEPath, string(pp.Type), pName, schemaInterface)))("cannot build schema link"),
		Go:     goLink,
		Ts:     elsedie(url.JoinPath(repoBaseURL, fmt.Sprintf(composableTSPath, string(pp.Type), pName, schemaInterface)))("cannot build ts link"),
		Docs:   elsedie(url.JoinPath(docsBaseURL, category, cp.MachineName, "schema-reference"))("cannot build docs link"),
	}
}

func grafanaMaturityAttrCount(sch cue.Value) int {
	const attr = "grafanamaturity"
	aw := new(kindsysreport.AttributeWalker)
	return aw.Count(sch, attr)[attr]
}

func findCodeOwners(of kindsysreport.CodeOwnersFinder, links KindLinks) []string {
	owners := elsedie(of.FindFor([]string{
		toLocalPath(links.Schema),
		toLocalPath(links.Go),
		toLocalPath(links.Ts),
	}...))("cannot find code owners")

	sort.Strings(owners)
	return owners
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

func toLocalPath(s string) string {
	return strings.Replace(s, repoBaseURL+"/", "", 1)
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
