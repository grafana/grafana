package api

import (
	"io/fs"
	"os"
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/plugins"
)

func Test_shouldExclude(t *testing.T) {
	pluginInfo := plugins.PluginInfo{
		Logos: plugins.PluginLogos{
			Small: "img/small.svg",
			Large: "img/large.svg",
		},
	}

	type args struct {
		fi        os.FileInfo
		reqPath   string
		p         *plugins.PluginBase
		pFilePath string
	}
	tests := []struct {
		name      string
		args      args
		forbidden bool
	}{
		{
			name: ".exe files are forbidden",
			args: args{
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
			args: args{
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
			args: args{
				fi: testFileInfo{
					name: "module.js",
				},
				p: &plugins.PluginBase{
					Info:   pluginInfo,
					Module: "test/module",
				},
				pFilePath: "/plugins/test/module.js",
			},
			forbidden: false,
		},
		{
			name: "module.js is not forbidden if set correctly on plugin",
			args: args{
				fi: testFileInfo{
					name: "module.js",
				},
				p: &plugins.PluginBase{
					Info: pluginInfo,
				},
				pFilePath: "/plugins/test/module.js",
			},
			forbidden: false,
		},
		{
			name: "module.js is forbidden if not set correctly on plugin",
			args: args{
				fi: testFileInfo{
					name: "incorrect_name.js",
				},
				p: &plugins.PluginBase{
					Info: pluginInfo,
				},
				pFilePath: "/plugins/test/module.js",
			},
			forbidden: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := accessForbidden(tt.args.fi, tt.args.reqPath, tt.args.pFilePath, tt.args.p); got != tt.forbidden {
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
