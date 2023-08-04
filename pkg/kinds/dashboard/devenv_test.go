package dashboard_test

import (
	"encoding/json"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"testing"

	"cuelang.org/go/cue/errors"
	"github.com/grafana/kindsys/encoding"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/kinds"
	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/registry/corekind"
)

// TODO these should all go away
var skiplist = map[string]string{
	"feature-templating/datadata-macros.json":            "instance of common.TableFooterOptions.fields contains empty string",
	"panel-common/shared_queries.json":                   "instance of common.TableFooterOptions.fields contains empty string",
	"transforms/reuse.json":                              "instance of common.TableFooterOptions.fields contains empty string",
	"transforms/filter.json":                             "instance of common.TableFooterOptions.fields contains empty string",
	"transforms/extract-json-paths.json":                 "instance of common.TableFooterOptions.fields contains empty string",
	"transforms/join-by-field.json":                      "instance of common.TableFooterOptions.fields contains empty string",
	"transforms/join-by-labels.json":                     "instance of common.TableFooterOptions.fields contains empty string",
	"panel-timeseries/timeseries-formats.json":           "instance of common.TableFooterOptions.fields contains empty string",
	"panel-table/table_tests_new.json":                   "instance of common.TableFooterOptions.fields contains empty string",
	"panel-table/table_sparkline_cell.json":              "instance of common.TableFooterOptions.fields contains empty string",
	"datasource-elasticsearch/elasticsearch_simple.json": "instance of common.TableFooterOptions.fields contains empty string",

	"e2e-repeats/Repeating-a-row-with-a-non-repeating-panel-and-horizontal-repeating-panel.json": "instance of common.VizLegendOptions.showLegend is absent",
	"e2e-repeats/Repeating-a-panel-horizontally.json":                                            "instance of common.VizLegendOptions.showLegend is absent",
	"panel-barchart/barchart-autosizing.json":                                                    "instance of common.VizLegendOptions.showLegend is absent",
	"panel-timeseries/timeseries-stacking2.json":                                                 "instance of common.VizLegendOptions.showLegend is absent",

	"panel-barchart/barchart-label-rotation-skipping.json": "instance of barchart.Options.xTickLabelMaxLength is absent",
	"panel-barchart/barchart-thresholds-mappings.json":     "instance of barchart.Options.xTickLabelMaxLength is absent",
	"panel-barchart/barchart-tooltips.json":                "instance of barchart.Options.xTickLabelMaxLength is absent",

	"panel-histogram/histogram_tests.json": "instance of common.OptionsWithTooltip.mode is absent, probably needs a default",

	"panel-candlestick/candlestick.json": "many required fields are absent - seems like lots of defaults needed?",

	"panel-heatmap/heatmap-legacy.json": "tons of missing fields in the data - is this a problem with how we're converting a legacy heatmap panel, perhaps?",

	"panel-heatmap/heatmap-calculate-log.json":  "odd whole-panel errors",
	"panel-heatmap/heatmap-x.json":              "odd whole-panel errors",
	"panel-bargauge/panel_tests_bar_gauge.json": "for some reason only wanting the graph or heatmap branch path",

	// In each of these cases, there's a real mismatch between the schema and the
	// datasource in question. But the error massager in thema that makes CUE errors
	// more readable by differentiating what the schema specifies from what the data contains
	// has a bug that's causing an error without any string output to be emitted.
	//
	// Because the massager's behavior depends on the logical nature of the error,
	// it's plausible that all of the following problems are have the same logical
	// structure - for example, data contains some value that's not included on any
	// branch of a union type specified in the schema.
	"panel-canvas/canvas-examples.json":                       "thema error massager is swallowing the whole error message",
	"panel-canvas/canvas-connection-examples.json":            "thema error massager is swallowing the whole error message",
	"panel-geomap/geomap-color-field.json":                    "thema error massager is swallowing the whole error message",
	"panel-geomap/geomap-photo-layer.json":                    "thema error massager is swallowing the whole error message",
	"panel-geomap/geomap-route-layer.json":                    "thema error massager is swallowing the whole error message",
	"panel-geomap/geomap-spatial-operations-transformer.json": "thema error massager is swallowing the whole error message",
	"panel-geomap/geomap_multi-layers.json":                   "thema error massager is swallowing the whole error message",
	"panel-geomap/panel-geomap.json":                          "thema error massager is swallowing the whole error message",
	"panel-geomap/geomap-v91.json":                            "thema error massager is swallowing the whole error message",
	"panel-timeseries/timeseries-nulls.json":                  "thema error massager is swallowing the whole error message",
}

func TestDevenvDashboardValidity(t *testing.T) {
	dpath, err := filepath.Abs("../../../devenv/dev-dashboards")
	require.NoError(t, err)

	m, err := kindTestableDashboards(os.DirFS(dpath))
	require.NoError(t, err)
	dk := corekind.NewDist(nil).ByName("Dashboard")
	require.NotNil(t, dk)
	// dk, err := dashboard.NewKind(cuectx.GrafanaThemaRuntime())
	// require.NoError(t, err)

	type res struct {
		Kind       string                        `json:"kind"`
		APIVersion string                        `json:"apiVersion"`
		Metadata   kinds.GrafanaResourceMetadata `json:"metadata"`
		Spec       json.RawMessage               `json:"spec"`
	}

	for _, pb := range m {
		path, b := pb.path, pb.b
		t.Run(path, func(t *testing.T) {
			// Unfortunately, assembling the translated resource this way means that we
			// don't have real line numbers in errors emitted from CUE. We could if we
			// dynamically pieced the parts together in CUE, but because the
			// kindsys.Core.Validate() method doesn't take a cue.Value, we'd lose that
			// context again.
			k8sr := res{
				Kind:       "Dashboard",
				APIVersion: "core.kinds.grafana.com/v0-0-alpha",
				Metadata: kinds.GrafanaResourceMetadata{
					Name: path,
				},
				Spec: b,
			}

			b, err = json.Marshal(k8sr)
			require.NoError(t, err)

			err = dk.Validate(b, &encoding.KubernetesJSONDecoder{})
			if err != nil {
				// Testify trims errors to short length. We want the full text
				t.Logf("%T, %s", err, err)
				errstr := errors.Details(err, nil)
				t.Log(errstr)
				if reason, has := skiplist[path]; has {
					t.Skip(reason)
				}
				t.FailNow()
			}
		})
	}
}

type pathbyt struct {
	path string
	b    []byte
}

func kindTestableDashboards(in fs.FS) ([]pathbyt, error) {
	var pb []pathbyt

	err := fs.WalkDir(in, ".", func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() || filepath.Ext(d.Name()) != ".json" {
			return nil
		}

		// nolint:gosec
		f, err := in.Open(path)
		if err != nil {
			return err
		}
		defer f.Close() //nolint:errcheck

		b, err := io.ReadAll(f)
		if err != nil {
			return err
		}

		jtree := make(map[string]interface{})
		err = json.Unmarshal(b, &jtree)
		if err != nil {
			return err
		}
		if oldschemav, has := jtree["schemaVersion"]; !has || !(oldschemav.(float64) > dashboard.HandoffSchemaVersion-1) {
			return nil
		}

		pb = append(pb, pathbyt{path, b})
		return nil
	})

	if err != nil {
		return nil, err
	}

	sort.Slice(pb, func(i, j int) bool {
		return pb[i].path < pb[j].path
	})

	return pb, nil
}
