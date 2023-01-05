//go:build ignore
// +build ignore

//go:generate go run report.go

package main

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"reflect"
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

type Kind struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	Maturity string `json:"maturity"`
}

type KindStateReport struct {
	Kinds      map[string]Kind      `json:"kinds"`
	Dimensions map[string]Dimension `json:"dimensions"`
}

type Dimension map[string]DimensionValue

type DimensionValue struct {
	Name  string   `json:"name"`
	Items []string `json:"items"`
	Count int      `json:"count"`
}

// emptyKindStateReport is used to ensure certain
// dimension values are present (even if empty) in
// the final report.
func emptyKindStateReport() KindStateReport {
	return KindStateReport{
		Kinds: make(map[string]Kind),
		Dimensions: map[string]Dimension{
			"maturity": {
				"merged":       emptyDimensionValue("merged"),
				"experimental": emptyDimensionValue("experimental"),
				"stable":       emptyDimensionValue("stable"),
				"mature":       emptyDimensionValue("mature"),
			},
			"type": {
				"core":       emptyDimensionValue("core"),
				"raw":        emptyDimensionValue("raw"),
				"composable": emptyDimensionValue("composable"),
			},
		},
	}
}

func emptyDimensionValue(name string) DimensionValue {
	return DimensionValue{
		Name:  name,
		Items: make([]string, 0),
		Count: 0,
	}
}

func buildKindStateReport() KindStateReport {
	r := emptyKindStateReport()
	kk := buildKindsList()

	for _, k := range kk {
		r.Kinds[k.Name] = k

		// We consider every Kind field as a dimension
		for _, field := range reflect.VisibleFields(reflect.TypeOf(k)) {
			// Except for the Kind's name (id) -- its machine name.
			if field.Name == "Name" {
				continue
			}

			// If we haven't seen that dimension yet.
			dimName := machinize(field.Name)
			if _, ok := r.Dimensions[dimName]; !ok {
				r.Dimensions[dimName] = make(Dimension)
			}

			// If we haven't seen that dimension value yet.
			value := reflect.Indirect(reflect.ValueOf(k)).FieldByName(field.Name).String()
			if _, ok := r.Dimensions[dimName][value]; !ok {
				r.Dimensions[dimName][value] = emptyDimensionValue(value)
			}

			// Finally, we account the Kind for the dimension value
			dimValue := r.Dimensions[dimName][value]
			dimValue.Count++
			dimValue.Items = append(dimValue.Items, k.Name)
			r.Dimensions[dimName][value] = dimValue
		}
	}

	return r
}

func buildKindsList() []Kind {
	kk := make([]Kind, 0)
	b := corekind.NewBase(nil)

	seen := make(map[string]bool)
	for _, k := range b.All() {
		seen[k.Props().Common().Name] = true

		var kType string
		switch k.Props().(type) {
		case kindsys.CoreStructuredProperties:
			kType = "core"
		case kindsys.RawProperties:
			kType = "raw"
		}

		kk = append(kk, Kind{
			Name:     k.MachineName(),
			Type:     kType,
			Maturity: k.Props().Common().Maturity.String(),
		})
	}

	for _, kn := range plannedCoreKinds {
		if seen[kn] {
			continue
		}
		kk = append(kk, Kind{
			Name:     machinize(kn),
			Type:     "core",
			Maturity: "planned",
		})
	}

	all := kindsys.AllSlots(nil)
	// TODO this is all hacks until #59001, which will unite plugins with kindsys
	for _, tree := range corelist.New(nil) {
		rp := tree.RootPlugin()
		for _, slot := range all {
			if may, _ := slot.ForPluginType(string(rp.Meta().Type)); may {
				n := fmt.Sprintf("%s-%s", strings.Title(rp.Meta().Id), slot.Name())
				maturity := "planned"
				if _, has := rp.SlotImplementations()[slot.Name()]; has {
					maturity = "merged"
				}
				kk = append(kk, Kind{
					Name:     machinize(n),
					Type:     "composable",
					Maturity: maturity,
				})
			}
		}
	}

	sort.Slice(kk, func(i, j int) bool {
		return kk[i].Name < kk[j].Name
	})

	return kk
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
