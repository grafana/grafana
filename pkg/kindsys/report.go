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
var plannedCoreKinds = []string {
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
	Core       []kindsys.CoreStructuredProperties `json:"core"`
	Raw        []kindsys.RawProperties            `json:"raw"`
	Composable []kindsys.ComposableProperties     `json:"composable"`
}

func emptyKindStateReport() KindStateReport {
	return KindStateReport{
		Core:       make([]kindsys.CoreStructuredProperties, 0),
		Raw:        make([]kindsys.RawProperties, 0),
		Composable: make([]kindsys.ComposableProperties, 0),
	}
}

func buildKindStateReport() KindStateReport {
	r := emptyKindStateReport()
	b := corekind.NewBase(nil)

	seen := make(map[string]bool)
	for _, k := range b.All() {
		seen[k.Props().Common().Name] = true
		switch props := k.Props().(type) {
		case kindsys.CoreStructuredProperties:
			r.Core = append(r.Core, props)
		case kindsys.RawProperties:
			r.Raw = append(r.Raw, props)
		}
	}

	for _, kn := range plannedCoreKinds {
		if seen[kn] {
			continue
		}
		r.Core = append(r.Core, kindsys.CoreStructuredProperties{
			CommonProperties: kindsys.CommonProperties{
				Name: kn,
				PluralName: kn + "s",
				MachineName: machinize(kn),
				PluralMachineName: machinize(kn) + "s",
				Maturity: "planned",
			},
		})
	}

	all := kindsys.AllSlots(nil)
	// TODO this is all hacks until #59001, which will unite plugins with kindsys
	for _, tree := range corelist.New(nil) {
		rp := tree.RootPlugin()
		for _, slot := range all {
			if may, _ := slot.ForPluginType(string(rp.Meta().Type)); may {
				n := fmt.Sprintf("%s-%s", strings.Title(rp.Meta().Id), slot.Name())
				props := kindsys.ComposableProperties{
					CommonProperties: kindsys.CommonProperties{
						Name:              n,
						PluralName:        n + "s",
						MachineName:       machinize(n),
						PluralMachineName: machinize(n) + "s",
						LineageIsGroup:    slot.IsGroup(),
						Maturity:          "planned",
					},
				}
				if ck, has := rp.SlotImplementations()[slot.Name()]; has {
					props.CommonProperties.Maturity = "merged"
					props.CurrentVersion = ck.Latest().Version()
				}
				r.Composable = append(r.Composable, props)
			}
		}
	}

	sort.Slice(r.Core, func(i, j int) bool {
		return r.Core[i].Common().Name < r.Core[j].Common().Name
	})
	sort.Slice(r.Composable, func(i, j int) bool {
		return r.Composable[i].Common().Name < r.Composable[j].Common().Name
	})

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
