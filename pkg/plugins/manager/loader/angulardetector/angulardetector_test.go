package angulardetector

import (
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/stretchr/testify/require"
)

func TestAngularDetector_Inspect(t *testing.T) {
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

	// Not angular
	tcs = append(tcs, tc{
		name: "not angular",
		plugin: &plugins.Plugin{
			FS: plugins.NewInMemoryFS(map[string][]byte{
				"module.js": []byte(`import { PanelPlugin } from '@grafana/data'`),
			}),
		},
		exp: false,
	})
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			isAngular, err := Inspect(tc.plugin)
			require.NoError(t, err)
			require.Equal(t, tc.exp, isAngular)
		})
	}
}
