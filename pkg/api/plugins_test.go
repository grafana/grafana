package api

import (
	"io/fs"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
)

func Test_accessForbidden(t *testing.T) {
	pluginInfo := plugins.PluginInfo{
		Logos: plugins.PluginLogos{
			Small: "img/small.svg",
			Large: "img/large.svg",
		},
	}

	type testCase struct {
		fi      os.FileInfo
		reqPath string
		p       *plugins.PluginBase
	}
	tests := []struct {
		name      string
		t         testCase
		forbidden bool
	}{
		{
			name: ".exe files are forbidden",
			t: testCase{
				reqPath: "/bin/test.exe",
				fi: testFileInfo{
					name: "test.exe",
				},
				p: &plugins.PluginBase{
					Info: pluginInfo,
				},
			},
			forbidden: true,
		},
		{
			name: ".sh files are forbidden",
			t: testCase{
				reqPath: "scripts/test.sh",
				fi: testFileInfo{
					name: "test.sh",
				},
				p: &plugins.PluginBase{
					Info: pluginInfo,
				},
			},
			forbidden: true,
		},
		{
			name: "module.js is not forbidden",
			t: testCase{
				fi: testFileInfo{
					name: "module.js",
				},
				p: &plugins.PluginBase{
					Info:   pluginInfo,
					Module: "test/module",
				},
			},
			forbidden: false,
		},
		{
			name: "module.js is not forbidden if set correctly on plugin",
			t: testCase{
				fi: testFileInfo{
					name: "module.js",
				},
				p: &plugins.PluginBase{
					Info: pluginInfo,
				},
			},
			forbidden: false,
		},
		{
			name: "module.js is forbidden if not set correctly on plugin",
			t: testCase{
				fi: testFileInfo{
					name: "incorrect_name.js",
				},
				p: &plugins.PluginBase{
					Info: pluginInfo,
				},
			},
			forbidden: false,
		},
		{
			name: "logos are not forbidden",
			t: testCase{
				reqPath: "/img/small.svg",
				p: &plugins.PluginBase{
					Info: pluginInfo,
				},
			},
			forbidden: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := accessForbidden(tt.t.fi, tt.t.reqPath, tt.t.p); got != tt.forbidden {
				t.Errorf("accessForbidden() = %v, forbidden %v", got, tt.forbidden)
			}
		})
	}
}

type testFileInfo struct {
	name       string
	executable bool
}

func (t testFileInfo) Name() string {
	return t.name
}

func (t testFileInfo) Size() int64 {
	return 0
}

func (t testFileInfo) Mode() fs.FileMode {
	if t.executable {
		return fs.FileMode(0111)
	}
	return fs.FileMode(0)
}

func (t testFileInfo) ModTime() time.Time {
	return time.Time{}
}

func (t testFileInfo) IsDir() bool {
	return false
}

func (t testFileInfo) Sys() interface{} {
	return nil
}
