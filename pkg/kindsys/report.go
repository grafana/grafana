//go:build ignore
// +build ignore

//go:generate go run report.go

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"sort"
	"strings"

	"github.com/grafana/codejen"

	"github.com/grafana/grafana/pkg/kindsys"
	"github.com/grafana/grafana/pkg/plugins/pfs/corelist"
	"github.com/grafana/grafana/pkg/registry/corekind"
)

const reportFileName = "report.json"

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

type KindStateReport struct {
	Kinds      map[string]kindsys.SomeKindProperties `json:"kinds"`
	Dimensions map[string]Dimension                  `json:"dimensions"`
}

func (r *KindStateReport) add(k kindsys.SomeKindProperties, category string) {
	kName := k.Common().MachineName

	r.Kinds[kName] = k
	r.Dimensions["maturity"][k.Common().Maturity.String()].add(kName)
	r.Dimensions["category"][category].add(kName)
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
		Kinds: make(map[string]kindsys.SomeKindProperties),
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
		switch k.Props().(type) {
		case kindsys.CoreProperties:
			r.add(k.Props(), "core")
		}
	}

	for _, kn := range plannedCoreKinds {
		if seen[kn] {
			continue
		}

		r.add(kindsys.CoreProperties{
			CommonProperties: kindsys.CommonProperties{
				Name:              kn,
				PluralName:        kn + "s",
				MachineName:       machinize(kn),
				PluralMachineName: machinize(kn) + "s",
				Maturity:          "planned",
			},
		}, "core")
	}

	all := kindsys.SchemaInterfaces(nil)
	// TODO this is all hacks until #59001, which will unite plugins with kindsys
	for _, tree := range corelist.New(nil) {
		rp := tree.RootPlugin()
		for _, si := range all {
			if si.Should(string(rp.Meta().Type)) {
				n := fmt.Sprintf("%s-%s", strings.Title(rp.Meta().Id), si.Name())
				props := kindsys.ComposableProperties{
					CommonProperties: kindsys.CommonProperties{
						Name:              n,
						PluralName:        n + "s",
						MachineName:       machinize(n),
						PluralMachineName: machinize(n) + "s",
						LineageIsGroup:    si.IsGroup(),
						Maturity:          "planned",
					},
				}
				if ck, has := rp.SlotImplementations()[si.Name()]; has {
					props.CommonProperties.Maturity = "merged"
					props.CurrentVersion = ck.Latest().Version()
				}
				r.add(props, "composable")
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
