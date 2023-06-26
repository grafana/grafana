package angularinspector

import (
	"context"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/manager/loader/angular/angulardetector"
)

type fakeDetector struct {
	calls   int
	returns bool
}

func (d *fakeDetector) DetectAngular(_ []byte) bool {
	d.calls += 1
	return d.returns
}

func TestPatternsListInspector(t *testing.T) {
	plugin := &plugins.Plugin{
		FS: plugins.NewInMemoryFS(map[string][]byte{"module.js": nil}),
	}

	for _, tc := range []struct {
		name          string
		fakeDetectors []*fakeDetector
		exp           func(t *testing.T, r bool, err error, fakeDetectors []*fakeDetector)
	}{
		{
			name: "calls the detectors in sequence until true is returned",
			fakeDetectors: []*fakeDetector{
				{returns: false},
				{returns: true},
				{returns: false},
			},
			exp: func(t *testing.T, r bool, err error, fakeDetectors []*fakeDetector) {
				require.NoError(t, err)
				require.True(t, r, "inspector should return true")
				require.Equal(t, 1, fakeDetectors[0].calls, "fake 0 should be called")
				require.Equal(t, 1, fakeDetectors[1].calls, "fake 1 should be called")
				require.Equal(t, 0, fakeDetectors[2].calls, "fake 2 should not be called")
			},
		},
		{
			name: "calls the detectors in sequence and returns false as default",
			fakeDetectors: []*fakeDetector{
				{returns: false},
				{returns: false},
			},
			exp: func(t *testing.T, r bool, err error, fakeDetectors []*fakeDetector) {
				require.NoError(t, err)
				require.False(t, r, "inspector should return false")
				require.Equal(t, 1, fakeDetectors[0].calls, "fake 0 should not be called")
				require.Equal(t, 1, fakeDetectors[1].calls, "fake 1 should not be called")
			},
		},
		{
			name:          "empty detectors should return false",
			fakeDetectors: nil,
			exp: func(t *testing.T, r bool, err error, fakeDetectors []*fakeDetector) {
				require.NoError(t, err)
				require.False(t, r, "inspector should return false")
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			detectors := make([]angulardetector.AngularDetector, 0, len(tc.fakeDetectors))
			for _, d := range tc.fakeDetectors {
				detectors = append(detectors, angulardetector.AngularDetector(d))
			}
			inspector := &PatternsListInspector{
				DetectorsProvider: &angulardetector.StaticDetectorsProvider{Detectors: detectors},
			}
			r, err := inspector.Inspect(context.Background(), plugin)
			tc.exp(t, r, err, tc.fakeDetectors)
		})
	}
}

func TestDefaultStaticDetectorsInspector(t *testing.T) {
	// Tests the default hardcoded angular patterns

	type tc struct {
		name   string
		plugin *plugins.Plugin
		exp    bool
	}
	var tcs []tc

	// Angular imports
	for i, content := range [][]byte{
		[]byte(`import { MetricsPanelCtrl } from 'grafana/app/plugins/sdk';`),
		[]byte(`define(["app/plugins/sdk"],(function(n){return function(n){var t={};function e(r){if(t[r])return t[r].exports;var o=t[r]={i:r,l:!1,exports:{}};return n[r].call(o.exports,o,o.exports,e),o.l=!0,o.exports}return e.m=n,e.c=t,e.d=function(n,t,r){e.o(n,t)||Object.defineProperty(n,t,{enumerable:!0,get:r})},e.r=function(n){"undefined"!=typeof`),
		[]byte(`define(["app/plugins/sdk"],(function(n){return function(n){var t={};function e(r){if(t[r])return t[r].exports;var o=t[r]={i:r,l:!1,exports:{}};return n[r].call(o.exports,o,o.exports,e),o.l=!0,o.exports}return e.m=n,e.c=t,e.d=function(n,t,r){e.o(n,t)||Object.defineProperty(n,t,{enumerable:!0,get:r})},e.r=function(n){"undefined"!=typeof Symbol&&Symbol.toSt`),
		[]byte(`define(["react","lodash","@grafana/data","@grafana/ui","@emotion/css","@grafana/runtime","moment","app/core/utils/datemath","jquery","app/plugins/sdk","app/core/core_module","app/core/core","app/core/table_model","app/core/utils/kbn","app/core/config","angular"],(function(e,t,r,n,i,a,o,s,u,l,c,p,f,h,d,m){return function(e){var t={};function r(n){if(t[n])return t[n].exports;var i=t[n]={i:n,l:!1,exports:{}};retur`),
		[]byte(`exports_1("QueryCtrl", query_ctrl_1.PluginQueryCtrl);`),
		[]byte(`exports_1('QueryCtrl', query_ctrl_1.PluginQueryCtrl);`),
	} {
		tcs = append(tcs, tc{
			name: "angular " + strconv.Itoa(i),
			plugin: &plugins.Plugin{
				FS: plugins.NewInMemoryFS(map[string][]byte{
					"module.js": content,
				}),
			},
			exp: true,
		})
	}

	// Not angular (test against possible false detections)
	for i, content := range [][]byte{
		[]byte(`import { PanelPlugin } from '@grafana/data'`),
		// React ML app
		[]byte(`==(null===(t=e.components)||void 0===t?void 0:t.QueryCtrl)};function`),
	} {
		tcs = append(tcs, tc{
			name: "not angular " + strconv.Itoa(i),
			plugin: &plugins.Plugin{
				FS: plugins.NewInMemoryFS(map[string][]byte{
					"module.js": content,
				}),
			},
			exp: false,
		})
	}
	inspector := PatternsListInspector{DetectorsProvider: NewDefaultStaticDetectorsProvider()}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			isAngular, err := inspector.Inspect(context.Background(), tc.plugin)
			require.NoError(t, err)
			require.Equal(t, tc.exp, isAngular)
		})
	}

	t.Run("no module.js", func(t *testing.T) {
		p := &plugins.Plugin{FS: plugins.NewInMemoryFS(map[string][]byte{})}
		_, err := inspector.Inspect(context.Background(), p)
		require.NoError(t, err)
	})
}
