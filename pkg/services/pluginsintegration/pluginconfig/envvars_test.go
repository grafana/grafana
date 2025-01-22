package pluginconfig

import (
	"context"
	"strings"
	"testing"

	"gopkg.in/ini.v1"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana-azure-sdk-go/v2/azsettings"

	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/auth"
	"github.com/grafana/grafana/pkg/plugins/config"
	"github.com/grafana/grafana/pkg/plugins/envvars"
	"github.com/grafana/grafana/pkg/plugins/manager/fakes"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
)

func TestPluginEnvVarsProvider_PluginEnvVars(t *testing.T) {
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

		cfg := &PluginInstanceCfg{
			PluginSettings: map[string]map[string]string{
				"test": {
					"custom_env_var": "customVal",
				},
			},
			AWSAssumeRoleEnabled: true,
			Features:             featuremgmt.WithFeatures(),
		}

		provider := NewEnvVarsProvider(cfg, licensing)
		envVars := provider.PluginEnvVars(context.Background(), p)
		assert.Len(t, envVars, 6)
		assert.Equal(t, "GF_VERSION=", envVars[0])
		assert.Equal(t, "GF_EDITION=test", envVars[1])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_PATH=/path/to/ent/license", envVars[2])
		assert.Equal(t, "GF_ENTERPRISE_APP_URL=https://myorg.com/", envVars[3])
		assert.Equal(t, "GF_ENTERPRISE_LICENSE_TEXT=token", envVars[4])
		assert.Equal(t, "GF_PLUGIN_CUSTOM_ENV_VAR=customVal", envVars[5])
	})
}

func TestPluginEnvVarsProvider_skipHostEnvVars(t *testing.T) {
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
		cfg := setting.NewCfg()
		pCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)

		provider := NewEnvVarsProvider(pCfg, nil)
		envVars := provider.PluginEnvVars(context.Background(), p)

		// We want to test that the envvars.Provider does not add any of the host env vars.
		// When starting the plugin via go-plugin, ALL host env vars will be added by go-plugin,
		// but we are testing the envvars.Provider here, so that's outside the scope of this test.
		_, ok := getEnvVarWithExists(envVars, envVarName)
		require.False(t, ok, "host env var should not be present")
	})

	t.Run("with SkipHostEnvVars = true", func(t *testing.T) {
		p.SkipHostEnvVars = true

		cfg := setting.NewCfg()
		pCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)
		provider := NewEnvVarsProvider(pCfg, nil)

		t.Run("should populate allowed host env vars", func(t *testing.T) {
			// Set all allowed variables
			for _, ev := range envvars.PermittedHostEnvVarNames() {
				t.Setenv(ev, envVarValue)
			}
			envVars := provider.PluginEnvVars(context.Background(), p)

			// Test against each variable
			for _, expEvName := range envvars.PermittedHostEnvVarNames() {
				gotEvValue, ok := getEnvVarWithExists(envVars, expEvName)
				require.True(t, ok, "host env var should be present")
				require.Equal(t, envVarValue, gotEvValue)
			}
		})

		t.Run("should not populate host env vars that aren't allowed", func(t *testing.T) {
			// Set all allowed variables
			for _, ev := range envvars.PermittedHostEnvVarNames() {
				t.Setenv(ev, envVarValue)
			}
			// ...and an extra one, which should not leak
			const superSecretEnvVariableName = "SUPER_SECRET_VALUE"
			t.Setenv(superSecretEnvVariableName, "01189998819991197253")
			envVars := provider.PluginEnvVars(context.Background(), p)

			// Super secret should not leak
			_, ok := getEnvVarWithExists(envVars, superSecretEnvVariableName)
			require.False(t, ok, "super secret env var should not be leaked")

			// Everything else should be present
			for _, expEvName := range envvars.PermittedHostEnvVarNames() {
				var gotEvValue string
				gotEvValue, ok = getEnvVarWithExists(envVars, expEvName)
				require.True(t, ok, "host env var should be present")
				require.Equal(t, envVarValue, gotEvValue)
			}
		})
	})
}

func TestPluginEnvVarsProvider_tracingEnvironmentVariables(t *testing.T) {
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
		cfg    *PluginInstanceCfg
		plugin *plugins.Plugin
		exp    func(t *testing.T, envVars []string)
	}{
		{
			name: "otel not configured",
			cfg: &PluginInstanceCfg{
				AWSAssumeRoleEnabled: false,
				Tracing:              config.Tracing{},
			},
			plugin: defaultPlugin,
			exp:    expNoTracing,
		},
		{
			name: "otlp no propagation",
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
			},

			plugin: defaultPlugin,
			exp:    expDefaultOtlp,
		},
		{
			name: "otlp propagation plugin enabled",
			cfg: &PluginInstanceCfg{
				AWSAssumeRoleEnabled: true,
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
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				assert.Len(t, envVars, 7)
				assert.Equal(t, "GF_VERSION=", envVars[0])
				assert.Equal(t, "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317", envVars[1])
				assert.Equal(t, "GF_INSTANCE_OTLP_PROPAGATION=w3c", envVars[2])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_TYPE=", envVars[3])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_PARAM=1.000000", envVars[4])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL=", envVars[5])
				assert.Equal(t, "GF_PLUGIN_VERSION=1.0.0", envVars[6])
			},
		},
		{
			name: "otlp enabled composite propagation",
			cfg: &PluginInstanceCfg{
				AWSAssumeRoleEnabled: true,
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
			},
			plugin: defaultPlugin,
			exp: func(t *testing.T, envVars []string) {
				assert.Len(t, envVars, 7)
				assert.Equal(t, "GF_VERSION=", envVars[0])
				assert.Equal(t, "GF_INSTANCE_OTLP_ADDRESS=127.0.0.1:4317", envVars[1])
				assert.Equal(t, "GF_INSTANCE_OTLP_PROPAGATION=w3c,jaeger", envVars[2])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_TYPE=", envVars[3])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_PARAM=1.000000", envVars[4])
				assert.Equal(t, "GF_INSTANCE_OTLP_SAMPLER_REMOTE_URL=", envVars[5])
				assert.Equal(t, "GF_PLUGIN_VERSION=1.0.0", envVars[6])
			},
		},
		{
			name: "GF_PLUGIN_VERSION is not present if tracing is disabled",
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{},
				},
			},
			plugin: defaultPlugin,
			exp:    expGfPluginVersionNotPresent,
		},
		{
			name: "GF_PLUGIN_VERSION is present if tracing is enabled and plugin has version",
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: defaultOTelCfg,
				},
			},
			plugin: defaultPlugin,
			exp:    expGfPluginVersionPresent,
		},
		{
			name: "GF_PLUGIN_VERSION is not present if tracing is enabled but plugin doesn't have a version",
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{},
				},
			},
			plugin: pluginWithoutVersion,
			exp:    expGfPluginVersionNotPresent,
		},
		{
			name: "no sampling (neversample)",
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "",
						SamplerParam:     0.0,
						SamplerRemoteURL: "",
					},
				},
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
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "",
						SamplerParam:     0.5,
						SamplerRemoteURL: "",
					},
				},
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
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "const",
						SamplerParam:     0.5,
						SamplerRemoteURL: "",
					},
				},
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
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "rateLimiting",
						SamplerParam:     0.5,
						SamplerRemoteURL: "",
					},
				},
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
			cfg: &PluginInstanceCfg{
				Tracing: config.Tracing{
					OpenTelemetry: config.OpenTelemetryCfg{
						Address:          "127.0.0.1:4317",
						Propagation:      "jaeger",
						Sampler:          "remote",
						SamplerParam:     0.5,
						SamplerRemoteURL: "127.0.0.1:10001",
					},
				},
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
			p := NewEnvVarsProvider(tc.cfg, nil)
			envVars := p.PluginEnvVars(context.Background(), tc.plugin)
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

func TestPluginEnvVarsProvider_authEnvVars(t *testing.T) {
	t.Run("backend datasource with auth registration", func(t *testing.T) {
		p := &plugins.Plugin{
			JSONData: plugins.JSONData{
				ID:  "test",
				IAM: &auth.IAM{},
			},
			ExternalService: &auth.ExternalService{
				ClientID:     "clientID",
				ClientSecret: "clientSecret",
				PrivateKey:   "privatePem",
			},
		}

		cfg := &setting.Cfg{
			Raw:    ini.Empty(),
			AppURL: "https://myorg.com/",
		}

		pCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)

		provider := NewEnvVarsProvider(pCfg, nil)
		envVars := provider.PluginEnvVars(context.Background(), p)
		assert.Equal(t, "GF_VERSION=", envVars[0])
		assert.Equal(t, "GF_APP_URL=https://myorg.com/", envVars[1])
		assert.Equal(t, "GF_PLUGIN_APP_CLIENT_ID=clientID", envVars[2])
		assert.Equal(t, "GF_PLUGIN_APP_CLIENT_SECRET=clientSecret", envVars[3])
		assert.Equal(t, "GF_PLUGIN_APP_PRIVATE_KEY=privatePem", envVars[4])
	})
}

func TestPluginEnvVarsProvider_awsEnvVars(t *testing.T) {
	t.Run("backend datasource with aws settings", func(t *testing.T) {
		tcs := []struct {
			name             string
			pluginID         string
			forwardToPlugins []string
			expected         []string
		}{
			{
				name:             "Will generate AWS env vars for plugin as long as is in the forwardToPlugins list",
				forwardToPlugins: []string{"foobar-datasource", "cloudwatch", "prometheus"},
				pluginID:         "cloudwatch",
				expected:         []string{"GF_VERSION=", "AWS_AUTH_AssumeRoleEnabled=false", "AWS_AUTH_AllowedAuthProviders=grafana_assume_role,keys", "AWS_AUTH_EXTERNAL_ID=mock_external_id", "AWS_AUTH_SESSION_DURATION=10m", "AWS_CW_LIST_METRICS_PAGE_LIMIT=100"},
			},
			{
				name:             "Will not generate AWS env vars for plugin as long as is in not the forwardToPlugins list",
				forwardToPlugins: []string{"cloudwatch", "foobar-datasource"},
				pluginID:         "prometheus",
				expected:         []string{"GF_VERSION="},
			},
		}

		for _, tc := range tcs {
			p := &plugins.Plugin{
				JSONData: plugins.JSONData{
					ID: tc.pluginID,
				},
			}
			cfg := &PluginInstanceCfg{
				AWSAssumeRoleEnabled:      false,
				AWSAllowedAuthProviders:   []string{"grafana_assume_role", "keys"},
				AWSExternalId:             "mock_external_id",
				AWSSessionDuration:        "10m",
				AWSListMetricsPageLimit:   "100",
				AWSForwardSettingsPlugins: tc.forwardToPlugins,
				Features:                  featuremgmt.WithFeatures(),
			}

			provider := NewEnvVarsProvider(cfg, nil)
			envVars := provider.PluginEnvVars(context.Background(), p)
			assert.ElementsMatch(t, tc.expected, envVars)
		}
	})
}

func TestPluginEnvVarsProvider_featureToggleEnvVar(t *testing.T) {
	t.Run("backend datasource with feature toggle", func(t *testing.T) {
		expectedFeatures := []string{"feat-1", "feat-2"}
		featuresLookup := map[string]bool{
			expectedFeatures[0]: true,
			expectedFeatures[1]: true,
		}

		cfg := &PluginInstanceCfg{
			Features: featuremgmt.WithFeatures(expectedFeatures[0], true, expectedFeatures[1], true),
		}

		p := NewEnvVarsProvider(cfg, nil)
		envVars := p.PluginEnvVars(context.Background(), &plugins.Plugin{})
		assert.Equal(t, 2, len(envVars))

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

func TestPluginEnvVarsProvider_azureEnvVars(t *testing.T) {
	t.Run("backend datasource with azure settings", func(t *testing.T) {
		cfg := &setting.Cfg{
			Raw: ini.Empty(),
			Azure: &azsettings.AzureSettings{
				AzureAuthEnabled:        true,
				Cloud:                   azsettings.AzurePublic,
				ManagedIdentityEnabled:  true,
				ManagedIdentityClientId: "mock_managed_identity_client_id",
				WorkloadIdentityEnabled: true,
				WorkloadIdentitySettings: &azsettings.WorkloadIdentitySettings{
					TenantId:  "mock_workload_identity_tenant_id",
					ClientId:  "mock_workload_identity_client_id",
					TokenFile: "mock_workload_identity_token_file",
				},
				UserIdentityEnabled:                    true,
				UserIdentityFallbackCredentialsEnabled: true,
				UserIdentityTokenEndpoint: &azsettings.TokenEndpointSettings{
					TokenUrl:          "mock_user_identity_token_url",
					ClientId:          "mock_user_identity_client_id",
					ClientSecret:      "mock_user_identity_client_secret",
					UsernameAssertion: true,
				},
			},
		}

		pCfg, err := ProvidePluginInstanceConfig(cfg, setting.ProvideProvider(cfg), featuremgmt.WithFeatures())
		require.NoError(t, err)

		provider := NewEnvVarsProvider(pCfg, nil)
		envVars := provider.PluginEnvVars(context.Background(), &plugins.Plugin{})
		assert.ElementsMatch(t, []string{"GF_VERSION=", "GFAZPL_AZURE_CLOUD=AzureCloud", "GFAZPL_AZURE_AUTH_ENABLED=true",
			"GFAZPL_MANAGED_IDENTITY_ENABLED=true",
			"GFAZPL_MANAGED_IDENTITY_CLIENT_ID=mock_managed_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_ENABLED=true",
			"GFAZPL_WORKLOAD_IDENTITY_TENANT_ID=mock_workload_identity_tenant_id",
			"GFAZPL_WORKLOAD_IDENTITY_CLIENT_ID=mock_workload_identity_client_id",
			"GFAZPL_WORKLOAD_IDENTITY_TOKEN_FILE=mock_workload_identity_token_file",
			"GFAZPL_USER_IDENTITY_ENABLED=true",
			"GFAZPL_USER_IDENTITY_FALLBACK_SERVICE_CREDENTIALS_ENABLED=true",
			"GFAZPL_USER_IDENTITY_TOKEN_URL=mock_user_identity_token_url",
			"GFAZPL_USER_IDENTITY_CLIENT_ID=mock_user_identity_client_id",
			"GFAZPL_USER_IDENTITY_CLIENT_SECRET=mock_user_identity_client_secret",
			"GFAZPL_USER_IDENTITY_ASSERTION=username",
		}, envVars)
	})
}
