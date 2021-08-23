package initializer

import (
	"reflect"
	"testing"

	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/backendplugin"
	"github.com/grafana/grafana/pkg/setting"
)

func TestInitializer_Initialize(t *testing.T) {
	type fields struct {
		cfg     *setting.Cfg
		license models.Licensing
	}
	type args struct {
		p *plugins.PluginV2
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &Initializer{
				cfg:     tt.fields.cfg,
				license: tt.fields.license,
			}
			if err := i.Initialize(tt.args.p); (err != nil) != tt.wantErr {
				t.Errorf("Initialize() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestInitializer_InitializeWithFactory(t *testing.T) {
	type fields struct {
		cfg     *setting.Cfg
		license models.Licensing
	}
	type args struct {
		p       *plugins.PluginV2
		factory backendplugin.PluginFactoryFunc
	}
	tests := []struct {
		name    string
		fields  fields
		args    args
		wantErr bool
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &Initializer{
				cfg:     tt.fields.cfg,
				license: tt.fields.license,
			}
			if err := i.InitializeWithFactory(tt.args.p, tt.args.factory); (err != nil) != tt.wantErr {
				t.Errorf("InitializeWithFactory() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}

func TestInitializer_getAWSEnvironmentVariables(t *testing.T) {
	type fields struct {
		cfg     *setting.Cfg
		license models.Licensing
	}
	tests := []struct {
		name   string
		fields fields
		want   []string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &Initializer{
				cfg:     tt.fields.cfg,
				license: tt.fields.license,
			}
			if got := i.getAWSEnvironmentVariables(); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("getAWSEnvironmentVariables() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestInitializer_getAzureEnvironmentVariables(t *testing.T) {
	type fields struct {
		cfg     *setting.Cfg
		license models.Licensing
	}
	tests := []struct {
		name   string
		fields fields
		want   []string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &Initializer{
				cfg:     tt.fields.cfg,
				license: tt.fields.license,
			}
			if got := i.getAzureEnvironmentVariables(); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("getAzureEnvironmentVariables() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestInitializer_getPluginEnvVars(t *testing.T) {
	type fields struct {
		cfg     *setting.Cfg
		license models.Licensing
	}
	type args struct {
		plugin *plugins.PluginV2
	}
	tests := []struct {
		name   string
		fields fields
		args   args
		want   []string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			i := &Initializer{
				cfg:     tt.fields.cfg,
				license: tt.fields.license,
			}
			if got := i.getPluginEnvVars(tt.args.plugin); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("getPluginEnvVars() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestInitializer_handleModuleDefaults(t *testing.T) {
	type fields struct {
		cfg     *setting.Cfg
		license models.Licensing
	}
	type args struct {
		p *plugins.PluginV2
	}
	tests := []struct {
		name   string
		fields fields
		args   args
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			//i := &Initializer{
			//	cfg:     tt.fields.cfg,
			//	license: tt.fields.license,
			//}
		})
	}
}

func TestInitializer_setPathsBasedOnApp(t *testing.T) {
	type fields struct {
		cfg     *setting.Cfg
		license models.Licensing
	}
	type args struct {
		parent *plugins.PluginV2
		child  *plugins.PluginV2
	}
	tests := []struct {
		name   string
		fields fields
		args   args
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			//i := &Initializer{
			//	cfg:     tt.fields.cfg,
			//	license: tt.fields.license,
			//}
		})
	}
}

func TestNew(t *testing.T) {
	type args struct {
		cfg     *setting.Cfg
		license models.Licensing
	}
	tests := []struct {
		name string
		args args
		want Initializer
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := New(tt.args.cfg, tt.args.license); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("New() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_defaultLogoPath(t *testing.T) {
	type args struct {
		pluginType plugins.PluginType
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := defaultLogoPath(tt.args.pluginType); got != tt.want {
				t.Errorf("defaultLogoPath() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_evalRelativePluginUrlPath(t *testing.T) {
	type args struct {
		pathStr    string
		baseUrl    string
		pluginType plugins.PluginType
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := evalRelativePluginUrlPath(tt.args.pathStr, tt.args.baseUrl, tt.args.pluginType); got != tt.want {
				t.Errorf("evalRelativePluginUrlPath() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_getPluginLogoUrl(t *testing.T) {
	type args struct {
		pluginType plugins.PluginType
		path       string
		baseUrl    string
	}
	tests := []struct {
		name string
		args args
		want string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getPluginLogoUrl(tt.args.pluginType, tt.args.path, tt.args.baseUrl); got != tt.want {
				t.Errorf("getPluginLogoUrl() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_getPluginSettings(t *testing.T) {
	type args struct {
		plugID string
		cfg    *setting.Cfg
	}
	tests := []struct {
		name string
		args args
		want pluginSettings
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := getPluginSettings(tt.args.plugID, tt.args.cfg); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("getPluginSettings() = %v, want %v", got, tt.want)
			}
		})
	}
}

func Test_pluginSettings_ToEnv(t *testing.T) {
	type args struct {
		prefix  string
		hostEnv []string
	}
	tests := []struct {
		name string
		ps   pluginSettings
		args args
		want []string
	}{
		// TODO: Add test cases.
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.ps.ToEnv(tt.args.prefix, tt.args.hostEnv); !reflect.DeepEqual(got, tt.want) {
				t.Errorf("ToEnv() = %v, want %v", got, tt.want)
			}
		})
	}
}
