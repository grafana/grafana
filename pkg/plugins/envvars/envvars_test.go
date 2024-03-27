package envvars

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-azure-sdk-go/azsettings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/plugins/plugindef"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestInitializer_envVars(t *testing.T) {
	t.Run("backend datasource with license", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID: "test",
			},
		}

		licensing := &fakes.FakeLicensingService{
			LicenseEdition: "test",
			TokenRaw:       "token",
			LicensePath:    "/path/to/ent/license",
			LicenseAppURL:  "https://myorg.com/",
		}

		envVarsProvider := NewProvider(&config.Cfg{
			PluginSettings: map[string]map[string]string{
				"test": {
					"custom_env_var": "customVal",
				},
			},
			AWSAssumeRoleEnabled: true,
		}, licensing)

		envVars := envVarsProvider.Get(context.Background(), p)
		assert.Len(t, envVars, 6)
		assert.Equal(t, "GF_PLUGIN_CUSTOM_ENV_VAR=customVal", envVars[0])
		assert.Equal(t, "GF_VERSION=", envVars[1])
		assert.Equal(t, "GF_EDITION=test", envVars[2])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_PATH=/path/to/ent/license", envVars[3])
		assert.Equal(t, "GF_ENTERPRISE_APP_URL=https://myorg.com/", envVars[4])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_TEXT=token", envVars[5])
	})
}

func TestInitializer_skipHostEnvVars(t *testing.T) {
	const (
		envVarName  = "HTTP_PROXY"
		envVarValue = "lorem ipsum"
	)

	t.Setenv(envVarName, envVarValue)

	p := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID: "test",
		},
	}

	t.Run("without FlagPluginsSkipHostEnvVars should not populate host env vars", func(t *testing.T) {
		envVarsProvider := NewProvider(&config.Cfg{Features: featuremgmt.WithFeatures()}, nil)
		envVars := envVarsProvider.Get(context.Background(), p)

		// We want to test that the envvars.Provider does not add any of the host env vars.
		// When starting the plugin via go-plugin, ALL host env vars will be added by go-plugin,
		// but we are testing the envvars.Provider here, so that's outside the scope of this test.
		_, ok := getEnvVarWithExists(envVars, envVarName)
		require.False(t, ok, "host env var should not be present")
	})

	t.Run("with SkipHostEnvVars = true", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData:        plugins.JSONData{ID: "test"},
			SkipHostEnvVars: true,
		}
		envVarsProvider := NewProvider(&config.Cfg{}, nil)

		t.Run("should populate allowed host env vars", func(t *testing.T) {
			// Set all allowed variables
			for _, ev := range allowedHostEnvVarNames {
				t.Setenv(ev, envVarValue)
			}
			envVars := envVarsProvider.Get(context.Background(), p)

			// Test against each variable
			for _, expEvName := range allowedHostEnvVarNames {
				gotEvValue, ok := getEnvVarWithExists(envVars, expEvName)
				require.True(t, ok, "host env var should be present")
				require.Equal(t, envVarValue, gotEvValue)
			}
		})

		t.Run("should not populate host env vars that aren't allowed", func(t *testing.T) {
			// Set all allowed variables
			for _, ev := range allowedHostEnvVarNames {
				t.Setenv(ev, envVarValue)
			}
			// ...and an extra one, which should not leak
			const superSecretEnvVariableName = "SUPER_SECRET_VALUE"
			t.Setenv(superSecretEnvVariableName, "01189998819991197253")
			envVars := envVarsProvider.Get(context.Background(), p)

			// Super secret should not leak
			_, ok := getEnvVarWithExists(envVars, superSecretEnvVariableName)
			require.False(t, ok, "super secret env var should not be leaked")

			// Everything else should be present
			for _, expEvName := range allowedHostEnvVarNames {
				var gotEvValue string
				gotEvValue, ok = getEnvVarWithExists(envVars, expEvName)
				require.True(t, ok, "host env var should be present")
				require.Equal(t, envVarValue, gotEvValue)
			}
		})
	})
}

func TestInitializer_tracingEnvironmentVariables(t *testing.T) {
	const pluginID = "plugin_id"

	defaultPlugin := &plugins.Plugin{
		JSONData: plugins.JSONData{
			ID:   pluginID,
			Info: plugins.Info{Version: "1.0.0"},
		},
	}
	pluginWithoutVersion := &plugins.Plugin{
		JSONData: plugins.JSONData{ID: pluginID},
	}

	defaultOTelCfg := config.OpenTelemetryCfg{
		Address:     "127.0.0.1:4317",
		Propagation: "",
	}

	expDefaultOtlp := func(t *testing.T, envVars []string) {
		found := map[string]bool{
			"address":        false,
			"plugin_version": false,
			"propagation":    false,
		}
		setFound := func(v string) {
			require.False(t, found[v], "duplicate env var found")
			found[v] = true
		}
		for _, v := range envVars {
			switch v {
			case "GF_PLUGIN_VERSION=1.0.0":
				setFound("plugin_version")
			case "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317":
				setFound("address")
			case "GF_INSTANCE_OTLP_PROPAGATION=":
				setFound("propagation")
			}
		}
		for k, f := range found {
			require.Truef(t, f, "%q env var not found: %+v", k, envVars)
		}
	}
	expNoTracing := func(t *testing.T, envVars []string) {
		for _, v := range envVars {
			assert.False(t, strings.HasPrefix(v, "GF_TRACING"), "should not have tracing env var")
			assert.False(
				t,
				strings.HasPrefix(v, "GF_PLUGIN_VERSION"),
				"GF_PLUGIN_VERSION is tracing-only and should not be present when tracing is disabled",
			)
		}
	}
	expGfPluginVersionNotPresent := func(t *testing.T, envVars []string) {
		for _, e := range envVars {
			assert.False(t, strings.HasPrefix("GF_PLUGIN_VERSION=", e), "GF_PLUGIN_VERSION shouldn't be present")
		}
	}
	expGfPluginVersionPresent := func(t *testing.T, envVars []string) {
		var found bool
		for _, e := range envVars {
			if e != "GF_PLUGIN_VERSION=1.0.0" {
				continue
			}
			assert.False(t, found, "GF_PLUGIN_VERSION is present multiple times")
			found = true
		}
		assert.Truef(t, found, "GF_PLUGIN_VERSION is not present: %+v", envVars)
	}

	for _, tc := range []struct {
		name   string
		cfg    *config.Cfg
		plugin *plugins.Plugin
		exp    func(t *testing.T, envVars []string)
	}{
		{
			name: "otel not configured",
			cfg: &config.Cfg{
				Tracing:              config.Tracing{},
				AWSAssumeRoleEnabled: false,
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "otel not configured but plugin-tracing enabled",
			cfg: &config.Cfg{
				Tracing:        config.Tracing{},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "otlp no propagation plugin enabled",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"tracing": "true"},
				},
			},
			plugin: defaultPlugin,
			exp:    expDefaultOtlp,
		},
		{
			name: "otlp no propagation disabled by default",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "otlp propagation plugin enabled",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:     "127.0.0.1:4317",
						Propagation: "w3c",

						// Sensible default values for the sampler set by pkg/infra/tracing while reading config.ini
						Sampler:          "",
						SamplerParam:     1.0,
						SamplerRemoteURL: "",
					},
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"tracing": "true"},
				},
				AWSAssumeRoleEnabled: true,
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				assert.Len(t, envVars, 8)
				assert.Equal(t, "GF_PLUGIN_TRACING=true", envVars[0])
				assert.Equal(t, "GF_VERSION=", envVars[1])
				assert.Equal(t, "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317", envVars[2])
				assert.Equal(t, "GF_INSTANCE_OTLP_PROPAGATION=w3c", envVars[3])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_TYPE=", envVars[4])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_PARAM=1.000000", envVars[5])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL=", envVars[6])
				assert.Equal(t, "GF_PLUGIN_VERSION=1.0.0", envVars[7])
			},
		},
		{
			name: "otlp enabled composite propagation",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:     "127.0.0.1:4317",
						Propagation: "w3c,jaeger",

						// Sensible default values for the sampler set by pkg/infra/tracing while reading config.ini
						Sampler:          "",
						SamplerParam:     1.0,
						SamplerRemoteURL: "",
					},
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"tracing": "true"},
				},
				AWSAssumeRoleEnabled: true,
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				assert.Len(t, envVars, 8)
				assert.Equal(t, "GF_PLUGIN_TRACING=true", envVars[0])
				assert.Equal(t, "GF_VERSION=", envVars[1])
				assert.Equal(t, "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317", envVars[2])
				assert.Equal(t, "GF_INSTANCE_OTLP_PROPAGATION=w3c,jaeger", envVars[3])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_TYPE=", envVars[4])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_PARAM=1.000000", envVars[5])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL=", envVars[6])
				assert.Equal(t, "GF_PLUGIN_VERSION=1.0.0", envVars[7])
			},
		},
		{
			name: "otlp no propagation disabled by default",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:     "127.0.0.1:4317",
						Propagation: "w3c",
					},
				},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "disabled on plugin",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: setting.PluginSettings{
					pluginID: map[string]string{"tracing": "false"},
				},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "disabled on plugin with other plugin settings",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"some_other_option": "true"},
				},
				AWSAssumeRoleEnabled: true,
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "enabled on plugin with other plugin settings",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{
					pluginID: {"some_other_option": "true", "tracing": "true"},
				},
			},
			plugin: defaultPlugin,
			exp:    expDefaultOtlp,
		},
		{
			name: `enabled on plugin with no "tracing" plugin setting but with enablePluginsTracingByDefault feature flag`,
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{pluginID: {}},
				Features:       featuremgmt.WithFeatures(featuremgmt.FlagEnablePluginsTracingByDefault),
			},
			plugin: defaultPlugin,
			exp:    expDefaultOtlp,
		},
		{
			name: `enabled on plugin with plugin setting "tracing=false" but with enablePluginsTracingByDefault feature flag`,
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "false"}},
				Features:       featuremgmt.WithFeatures(featuremgmt.FlagEnablePluginsTracingByDefault),
			},
			plugin: defaultPlugin,
			exp:    expDefaultOtlp,
		},
		{
			name: "GF_PLUGIN_VERSION is not present if tracing is disabled",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp:    expGfPluginVersionNotPresent,
		},
		{
			name: "GF_PLUGIN_VERSION is present if tracing is enabled and plugin has version",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp:    expGfPluginVersionPresent,
		},
		{
			name: "GF_PLUGIN_VERSION is not present if tracing is enabled but plugin doesn't have a version",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: pluginWithoutVersion,
			exp:    expGfPluginVersionNotPresent,
		},
		{
			name: "no sampling (neversample)",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "",
						SamplerParam:     0.0,
						SamplerRemoteURL: "",
					},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				require.Empty(t, getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_TYPE"))
				require.Equal(t, "0.000000", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_PARAM"))
				require.Empty(t, getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL"))
			},
		},
		{
			name: "empty sampler with param",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "",
						SamplerParam:     0.5,
						SamplerRemoteURL: "",
					},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				require.Equal(t, "", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_TYPE"))
				require.Equal(t, "0.500000", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_PARAM"))
				require.Equal(t, "", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL"))
			},
		},
		{
			name: "const sampler with param",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "const",
						SamplerParam:     0.5,
						SamplerRemoteURL: "",
					},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				require.Equal(t, "const", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_TYPE"))
				require.Equal(t, "0.500000", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_PARAM"))
				require.Equal(t, "", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL"))
			},
		},
		{
			name: "rateLimiting sampler",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "rateLimiting",
						SamplerParam:     0.5,
						SamplerRemoteURL: "",
					},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				require.Equal(t, "rateLimiting", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_TYPE"))
				require.Equal(t, "0.500000", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_PARAM"))
				require.Equal(t, "", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL"))
			},
		},
		{
			name: "remote sampler",
			cfg: &config.Cfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "remote",
						SamplerParam:     0.5,
						SamplerRemoteURL: "127.0.0.1:10001",
					},
				},
				PluginSettings: map[string]map[string]string{pluginID: {"tracing": "true"}},
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				require.Equal(t, "remote", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_TYPE"))
				require.Equal(t, "0.500000", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_PARAM"))
				require.Equal(t, "127.0.0.1:10001", getEnvVar(envVars, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL"))
			},
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			envVarsProvider := NewProvider(tc.cfg, nil)
			envVars := envVarsProvider.Get(context.Background(), tc.plugin)
			tc.exp(t, envVars)
		})
	}
}

// getEnvVarWithExists takes a slice of strings in this format: "K=V" (env vars), and returns the "V" where K = wanted.
// If there's no such key, it returns false as the second argument.
func getEnvVarWithExists(vars []string, wanted string) (string, bool) {
	for _, v := range vars {
		parts := strings.SplitN(v, "=", 2)
		if parts[0] != wanted {
			continue
		}
		var r string
		if len(parts) < 2 {
			r = ""
		} else {
			r = parts[1]
		}
		return r, true
	}
	return "", false
}

// getEnvVar is like getEnvVarWithExists, but it returns just one string, without the boolean "ok" value.
// If the wanted environment variable does not exist, it returns an empty string.
func getEnvVar(vars []string, wanted string) string {
	v, _ := getEnvVarWithExists(vars, wanted)
	return v
}

func TestInitializer_authEnvVars(t *testing.T) {
	t.Run("backend datasource with auth registration", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:  "test",
				IAM: &plugindef.IAM{},
			},
			ExternalService: &auth.ExternalService{
				ClientID:     "clientID",
				ClientSecret: "clientSecret",
				PrivateKey:   "privatePem",
			},
		}

		envVarsProvider := NewProvider(&config.Cfg{
			GrafanaAppURL: "https://myorg.com/",
		}, nil)
		envVars := envVarsProvider.Get(context.Background(), p)
		assert.Equal(t, "GF_VERSION=", envVars[0])
		assert.Equal(t, "GF_APP_URL=https://myorg.com/", envVars[1])
		assert.Equal(t, "GF_PLUGIN_APP_CLIENT_ID=clientID", envVars[2])
		assert.Equal(t, "GF_PLUGIN_APP_CLIENT_SECRET=clientSecret", envVars[3])
		assert.Equal(t, "GF_PLUGIN_APP_PRIVATE_KEY=privatePem", envVars[4])
	})
}

func TestInitalizer_awsEnvVars(t *testing.T) {
	t.Run("backend datasource with aws settings", func(t *testing.T) {
		p := &plugins.Plugin{}
		envVarsProvider := NewProvider(&config.Cfg{
			AWSAssumeRoleEnabled:    false,
			AWSAllowedAuthProviders: []string{"grafana_assume_role", "keys"},
			AWSExternalId:           "mock_external_id",
			AWSSessionDuration:      "10m",
			AWSListMetricsPageLimit: "100",
		}, nil)
		envVars := envVarsProvider.Get(context.Background(), p)
		assert.ElementsMatch(t, []string{"GF_VERSION=", "AWS_AUTH_AssumeRoleEnabled=false", "AWS_AUTH_AllowedAuthProviders=grafana_assume_role,keys", "AWS_AUTH_EXTERNAL_ID=mock_external_id", "AWS_AUTH_SESSION_DURATION=10m", "AWS_CW_LIST_METRICS_PAGE_LIMIT=100"}, envVars)
	})
}

func TestInitializer_featureToggleEnvVar(t *testing.T) {
	t.Run("backend datasource with feature toggle", func(t *testing.T) {
		expectedFeatures := []string{"feat-1", "feat-2"}
		featuresLookup := map[string]bool{
			expectedFeatures[0]: true,
			expectedFeatures[1]: true,
		}

		p := &plugins.Plugin{}
		envVarsProvider := NewProvider(&config.Cfg{
			Features: featuremgmt.WithFeatures(expectedFeatures[0], true, expectedFeatures[1], true),
		}, nil)
		envVars := envVarsProvider.Get(context.Background(), p)

		assert.Equal(t, 3, len(envVars))

		toggleExpression := strings.Split(envVars[1], "=")
		assert.Equal(t, 2, len(toggleExpression))

		assert.Equal(t, "GF_INSTANCE_FEATURE_TOGGLES_ENABLE", toggleExpression[0])

		toggleArgs := toggleExpression[1]
		features := strings.Split(toggleArgs, ",")

		assert.Equal(t, len(expectedFeatures), len(features))

		// this is necessary because the features are not returned in the order they are provided
		for _, f := range features {
			_, ok := featuresLookup[f]
			assert.True(t, ok)
		}
	})
}

func TestInitalizer_azureEnvVars(t *testing.T) {
	t.Run("backend datasource with azure settings", func(t *testing.T) {
		p := &plugins.Plugin{}
		envVarsProvider := NewProvider(&config.Cfg{
			AWSAssumeRoleEnabled: true,
			Azure: &azsettings.AzureSettings{
				Cloud:                   azsettings.AzurePublic,
				ManagedIdentityEnabled:  true,
				ManagedIdentityClientId: "mock_managed_identity_client_id",
				WorkloadIdentityEnabled: true,
				WorkloadIdentitySettings: &azsettings.WorkloadIdentitySettings{
					TenantId:  "mock_workload_identity_tenant_id",
					ClientId:  "mock_workload_identity_client_id",
					TokenFile: "mock_workload_identity_token_file",
				},
				UserIdentityEnabled: true,
				UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
					TokenUrl:          "mock_user_identity_token_url",
					ClientId:          "mock_user_identity_client_id",
					ClientSecret:      "mock_user_identity_client_secret",
					UsernameAssertion: true,
				},
			},
		}, nil)
		envVars := envVarsProvider.Get(context.Background(), p)
		assert.ElementsMatch(t, []string{"GF_VERSION=", "GFAZPL_AZURE_CLOUD=AzureCloud", "GFAZPL_MANAGED_IDENTITY_ENABLED=true",
			"GFAZPL_MANAGED_IDENTITY_CLIENT_ID=mock_managed_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_ENABLED=true",
			"GFAZPL_WORKLOAD_IDENTITY_TENANT_ID=mock_workload_identity_tenant_id",
			"GFAZPL_WORKLOAD_IDENTITY_CLIENT_ID=mock_workload_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_TOKEN_FILE=mock_workload_identity_token_file",
			"GFAZPL_USER_IDENTITY_ENABLED=true",
			"GFAZPL_USER_IDENTITY_TOKEN_URL=mock_user_identity_token_url",
			"GFAZPL_USER_IDENTITY_CLIENT_ID=mock_user_identity_client_id",
			"GFAZPL_USER_IDENTITY_CLIENT_SECRET=mock_user_identity_client_secret",
			"GFAZPL_USER_IDENTITY_ASSERTION=username",
		}, envVars)
	})
}

func TestService_GetConfigMap(t *testing.T) {
	tcs := []struct {
		name     string
		cfg      *config.Cfg
		expected map[string]string
	}{
		{
			name: "Both features and proxy settings enabled",
			cfg: &config.Cfg{
				Features: featuremgmt.WithFeatures("feat-2", "feat-500", "feat-1"),
				ProxySettings: setting.SecureSocksDSProxySettings{
					Enabled:            true,
					ShowUI:             true,
					ClientCert:         "c3rt",
					ClientCertFilePath: "./c3rt",
					ClientKey:          "k3y",
					ClientKeyFilePath:  "./k3y",
					RootCAFilePaths:    []string{"./ca"},
					RootCAs:            []string{"ca"},
					ProxyAddress:       "https://proxy.grafana.com",
					ServerName:         "secureProxy",
					AllowInsecure:      true,
				},
			},
			expected: map[string]string{
				"GF_INSTANCE_FEATURE_TOGGLES_ENABLE":                 "feat-1,feat-2,feat-500",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_ENABLED":    "true",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_CERT":       "./c3rt",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_CERT_VAL":   "c3rt",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_KEY":        "./k3y",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_CLIENT_KEY_VAL":    "k3y",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT":      "./ca",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT_VALS": "ca",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_PROXY_ADDRESS":     "https://proxy.grafana.com",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_NAME":       "secureProxy",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_ALLOW_INSECURE":    "true",
			},
		},
		{
			name: "Features enabled but proxy settings disabled",
			cfg: &config.Cfg{
				Features: featuremgmt.WithFeatures("feat-2", "feat-500", "feat-1"),
				ProxySettings: setting.SecureSocksDSProxySettings{
					Enabled:      false,
					ShowUI:       true,
					ClientCert:   "c3rt",
					ClientKey:    "k3y",
					RootCAs:      []string{"ca"},
					ProxyAddress: "https://proxy.grafana.com",
					ServerName:   "secureProxy",
				},
			},
			expected: map[string]string{
				"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "feat-1,feat-2,feat-500",
			},
		},
		{
			name: "Both features and proxy settings disabled",
			cfg: &config.Cfg{
				Features: featuremgmt.WithFeatures("feat-2", false),
				ProxySettings: setting.SecureSocksDSProxySettings{
					Enabled:      false,
					ShowUI:       true,
					ClientCert:   "c3rt",
					ClientKey:    "k3y",
					RootCAs:      []string{"ca"},
					ProxyAddress: "https://proxy.grafana.com",
					ServerName:   "secureProxy",
				},
			},
			expected: map[string]string{},
		},
		{
			name: "Both features and proxy settings empty",
			cfg: &config.Cfg{
				Features:      nil,
				ProxySettings: setting.SecureSocksDSProxySettings{},
			},
			expected: map[string]string{},
		},
		{
			name: "Multiple Root CA certs in proxy settings are supported",
			cfg: &config.Cfg{
				ProxySettings: setting.SecureSocksDSProxySettings{
					Enabled:         true,
					ShowUI:          true,
					RootCAFilePaths: []string{"./ca", "./ca2"},
					RootCAs:         []string{"ca", "ca2"},
					ProxyAddress:    "https://proxy.grafana.com",
					ServerName:      "secureProxy",
					AllowInsecure:   true,
				},
				Features: featuremgmt.WithFeatures(),
			},
			expected: map[string]string{
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_ENABLED":    "true",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT":      "./ca ./ca2",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_ROOT_CA_CERT_VALS": "ca,ca2",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_PROXY_ADDRESS":     "https://proxy.grafana.com",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_SERVER_NAME":       "secureProxy",
				"GF_SECURE_SOCKS_DATASOURCE_PROXY_ALLOW_INSECURE":    "true",
			},
		},
	}
	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			s := &Service{
				cfg: tc.cfg,
			}
			require.Equal(t, tc.expected, s.GetConfigMap(context.Background(), "", nil))
		})
	}
}

func TestService_GetConfigMap_featureToggles(t *testing.T) {
	t.Run("Feature toggles list is deterministic", func(t *testing.T) {
		tcs := []struct {
			features       featuremgmt.FeatureToggles
			expectedConfig map[string]string
		}{
			{
				features:       nil,
				expectedConfig: map[string]string{},
			},
			{
				features:       featuremgmt.WithFeatures(),
				expectedConfig: map[string]string{},
			},
			{
				features:       featuremgmt.WithFeatures("A", "B", "C"),
				expectedConfig: map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "A,B,C"},
			},
			{
				features:       featuremgmt.WithFeatures("C", "B", "A"),
				expectedConfig: map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "A,B,C"},
			},
			{
				features:       featuremgmt.WithFeatures("b", "a", "c", "d"),
				expectedConfig: map[string]string{"GF_INSTANCE_FEATURE_TOGGLES_ENABLE": "a,b,c,d"},
			},
		}

		for _, tc := range tcs {
			s := &Service{
				cfg: &config.Cfg{
					Features: tc.features,
				},
			}
			require.Equal(t, tc.expectedConfig, s.GetConfigMap(context.Background(), "", nil))
		}
	})
}

func TestService_GetConfigMap_appURL(t *testing.T) {
	t.Run("Uses the configured app URL", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{
				GrafanaAppURL: "https://myorg.com/",
			},
		}
		require.Equal(t, map[string]string{"GF_APP_URL": "https://myorg.com/"}, s.GetConfigMap(context.Background(), "", nil))
	})
}

func TestService_GetConfigMap_concurrentQueryCount(t *testing.T) {
	t.Run("Uses the configured concurrent query count", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{
				ConcurrentQueryCount: 42,
			},
		}
		require.Equal(t, map[string]string{"GF_CONCURRENT_QUERY_COUNT": "42"}, s.GetConfigMap(context.Background(), "", nil))
	})

	t.Run("Doesn't set the concurrent query count if it is not in the config", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{},
		}
		require.Equal(t, map[string]string{}, s.GetConfigMap(context.Background(), "", nil))
	})

	t.Run("Doesn't set the concurrent query count if it is zero", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{
				ConcurrentQueryCount: 0,
			},
		}
		require.Equal(t, map[string]string{}, s.GetConfigMap(context.Background(), "", nil))
	})
}

func TestService_GetConfigMap_azureAuthEnabled(t *testing.T) {
	t.Run("Uses the configured azureAuthEnabled", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{
				AzureAuthEnabled: true,
			},
		}
		require.Equal(t, map[string]string{"GFAZPL_AZURE_AUTH_ENABLED": "true"}, s.GetConfigMap(context.Background(), "", nil))
	})

	t.Run("Doesn't set the azureAuthEnabled if it is not in the config", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{},
		}
		require.Equal(t, map[string]string{}, s.GetConfigMap(context.Background(), "", nil))
	})

	t.Run("Doesn't set the azureAuthEnabled if it is false", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{
				AzureAuthEnabled: false,
			},
		}
		require.Equal(t, map[string]string{}, s.GetConfigMap(context.Background(), "", nil))
	})
}

func TestService_GetConfigMap_azure(t *testing.T) {
	azSettings := &azsettings.AzureSettings{
		Cloud:                   azsettings.AzurePublic,
		ManagedIdentityEnabled:  true,
		ManagedIdentityClientId: "mock_managed_identity_client_id",
		WorkloadIdentityEnabled: true,
		WorkloadIdentitySettings: &azsettings.WorkloadIdentitySettings{
			TenantId:  "mock_workload_identity_tenant_id",
			ClientId:  "mock_workload_identity_client_id",
			TokenFile: "mock_workload_identity_token_file",
		},
		UserIdentityEnabled: true,
		UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
			TokenUrl:          "mock_user_identity_token_url",
			ClientId:          "mock_user_identity_client_id",
			ClientSecret:      "mock_user_identity_client_secret",
			UsernameAssertion: true,
		},
		ForwardSettingsPlugins: []string{"grafana-azure-monitor-datasource", "prometheus", "grafana-azure-data-explorer-datasource", "mssql"},
	}

	t.Run("uses the azure settings for an Azure plugin", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{
				Azure: azSettings,
			},
		}
		require.Equal(t, map[string]string{
			"GFAZPL_AZURE_CLOUD": "AzureCloud", "GFAZPL_MANAGED_IDENTITY_ENABLED": "true",
			"GFAZPL_MANAGED_IDENTITY_CLIENT_ID":   "mock_managed_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_ENABLED":    "true",
			"GFAZPL_WORKLOAD_IDENTITY_TENANT_ID":  "mock_workload_identity_tenant_id",
			"GFAZPL_WORKLOAD_IDENTITY_CLIENT_ID":  "mock_workload_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_TOKEN_FILE": "mock_workload_identity_token_file",
			"GFAZPL_USER_IDENTITY_ENABLED":        "true",
			"GFAZPL_USER_IDENTITY_TOKEN_URL":      "mock_user_identity_token_url",
			"GFAZPL_USER_IDENTITY_CLIENT_ID":      "mock_user_identity_client_id",
			"GFAZPL_USER_IDENTITY_CLIENT_SECRET":  "mock_user_identity_client_secret",
			"GFAZPL_USER_IDENTITY_ASSERTION":      "username",
		}, s.GetConfigMap(context.Background(), "grafana-azure-monitor-datasource", nil))
	})

	t.Run("does not use the azure settings for a non-Azure plugin", func(t *testing.T) {
		s := &Service{
			cfg: &config.Cfg{
				Azure: azSettings,
			},
		}
		require.Equal(t, map[string]string{}, s.GetConfigMap(context.Background(), "", nil))
	})

	t.Run("uses the azure settings for a non-Azure user-specified plugin", func(t *testing.T) {
		azSettings.ForwardSettingsPlugins = append(azSettings.ForwardSettingsPlugins, "test-datasource")
		s := &Service{
			cfg: &config.Cfg{
				Azure: azSettings,
			},
		}
		require.Equal(t, map[string]string{
			"GFAZPL_AZURE_CLOUD": "AzureCloud", "GFAZPL_MANAGED_IDENTITY_ENABLED": "true",
			"GFAZPL_MANAGED_IDENTITY_CLIENT_ID":   "mock_managed_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_ENABLED":    "true",
			"GFAZPL_WORKLOAD_IDENTITY_TENANT_ID":  "mock_workload_identity_tenant_id",
			"GFAZPL_WORKLOAD_IDENTITY_CLIENT_ID":  "mock_workload_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_TOKEN_FILE": "mock_workload_identity_token_file",
			"GFAZPL_USER_IDENTITY_ENABLED":        "true",
			"GFAZPL_USER_IDENTITY_TOKEN_URL":      "mock_user_identity_token_url",
			"GFAZPL_USER_IDENTITY_CLIENT_ID":      "mock_user_identity_client_id",
			"GFAZPL_USER_IDENTITY_CLIENT_SECRET":  "mock_user_identity_client_secret",
			"GFAZPL_USER_IDENTITY_ASSERTION":      "username",
		}, s.GetConfigMap(context.Background(), "test-datasource", nil))
	})
}

func TestService_GetConfigMap_aws(t *testing.T) {
	cfg := &config.Cfg{
		AWSAssumeRoleEnabled:      false,
		AWSAllowedAuthProviders:   []string{"grafana_assume_role", "keys"},
		AWSExternalId:             "mock_external_id",
		AWSSessionDuration:        "10m",
		AWSListMetricsPageLimit:   "100",
		AWSForwardSettingsPlugins: []string{"cloudwatch", "prometheus", "elasticsearch"},
	}

	t.Run("uses the aws settings for an AWS plugin", func(t *testing.T) {
		s := &Service{
			cfg: cfg,
		}
		require.Equal(t, map[string]string{
			"AWS_AUTH_AssumeRoleEnabled":     "false",
			"AWS_AUTH_AllowedAuthProviders":  "grafana_assume_role,keys",
			"AWS_AUTH_EXTERNAL_ID":           "mock_external_id",
			"AWS_AUTH_SESSION_DURATION":      "10m",
			"AWS_CW_LIST_METRICS_PAGE_LIMIT": "100",
		}, s.GetConfigMap(context.Background(), "cloudwatch", nil))
	})

	t.Run("does not use the aws settings for a non-aws plugin", func(t *testing.T) {
		s := &Service{
			cfg: cfg,
		}
		require.Equal(t, map[string]string{}, s.GetConfigMap(context.Background(), "", nil))
	})

	t.Run("uses the aws settings for a non-aws user-specified plugin", func(t *testing.T) {
		cfg.AWSForwardSettingsPlugins = append(cfg.AWSForwardSettingsPlugins, "test-datasource")
		s := &Service{
			cfg: cfg,
		}
		require.Equal(t, map[string]string{
			"AWS_AUTH_AssumeRoleEnabled":     "false",
			"AWS_AUTH_AllowedAuthProviders":  "grafana_assume_role,keys",
			"AWS_AUTH_EXTERNAL_ID":           "mock_external_id",
			"AWS_AUTH_SESSION_DURATION":      "10m",
			"AWS_CW_LIST_METRICS_PAGE_LIMIT": "100",
		}, s.GetConfigMap(context.Background(), "test-datasource", nil))
	})
}
