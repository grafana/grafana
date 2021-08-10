package manager

import (
	"errors"
	"reflect"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/setting"
)

func TestFinder_Find(t *testing.T) {
	testCases := []struct {
		name       string
		cfg        *setting.Cfg
		pluginsDir string
		want       []string
		err        error
	}{
		{
			name: "Find() happy path",
			cfg: &setting.Cfg{
				PluginSettings: nil,
			},
			pluginsDir: "./testdata/valid-v2-signature",
			want:       []string{"grafana/pkg/plugins/manager/testdata/valid-v2-signature/plugin/plugin.json"},
		},
	}
	for _, test := range testCases {
		t.Run(test.name, func(t *testing.T) {
			f := &Finder{
				Cfg: test.cfg,
				log: &FakeLogger{},
			}
			got, err := f.Find(test.pluginsDir)
			if (err != nil) && !errors.Is(err, test.err) {
				t.Errorf("Find() error = %v, wantErr %v", err, test.err)
				return
			}
			assert.Equal(t, len(test.want), len(got))

			for i := 0; i < len(test.want); i++ {
				assert.True(t, strings.HasSuffix(got[i], test.want[i]))
			}
		})
	}
}

func TestFinder_getPluginJSONPaths(t *testing.T) {
	type fields struct {
		Cfg *setting.Cfg
		log log.Logger
	}
	type args struct {
		rootDirPath string
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		want    []string
		wantErr bool
	}{
		{
			name:    "",
			fields:  fields{},
			args:    args{},
			want:    nil,
			wantErr: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := &Finder{
				Cfg: tt.fields.Cfg,
				log: tt.fields.log,
			}
			got, err := f.getPluginJSONPaths(tt.args.rootDirPath)
			if (err != nil) != tt.wantErr {
				t.Errorf("getPluginJSONPaths() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if !reflect.DeepEqual(got, tt.want) {
				t.Errorf("getPluginJSONPaths() got = %v, want %v", got, tt.want)
			}
		})
	}
}

type FakeLogger struct {
	log.Logger
}

func (fl *FakeLogger) Debug(testMessage string, ctx ...interface{}) {
}

func (fl *FakeLogger) Info(testMessage string, ctx ...interface{}) {
}

func (fl *FakeLogger) Warn(testMessage string, ctx ...interface{}) {
}

func (fl *FakeLogger) Error(testMessage string, ctx ...interface{}) {
}
