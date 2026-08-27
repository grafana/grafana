package commands

import (
	"encoding/json"
	"fmt"
	"os"
	"slices"
	"strings"

	"github.com/go-logr/logr"
	"github.com/urfave/cli/v2"
	"k8s.io/klog/v2"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/utils"
	"github.com/grafana/grafana/pkg/plugins"
	"github.com/grafana/grafana/pkg/plugins/definition"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin/pluginopenapi"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginconfig"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsources"
	"github.com/grafana/grafana/pkg/setting"
)

// writeOpenAPICommand renders the OpenAPI v3 spec an app plugin's API server
// serves, without starting Grafana. It is the offline equivalent of
// GET /openapi/v3/apis/{pluginID}/{version} on a running server.
func writeOpenAPICommand(c *cli.Context) error {
	cmd := &utils.ContextCommandLine{Context: c}

	target, output, err := writeOpenAPIArgs(c)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}
	pluginID, version, _ := strings.Cut(target, "/")

	args := strings.Split(c.String("configOverrides"), " ")
	if output == "" {
		// Loading the config logs to the console, which is stdout, and that is
		// where the spec goes when no output file was given. The file log mode
		// is on by default, so the same messages are still recorded.
		args = append(args, "cfg:log.mode=file")
	}

	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		Args:     args,
	})
	if err != nil {
		return err
	}

	features, err := featuremgmt.ProvideManagerService(cfg)
	if err != nil {
		return err
	}

	plugin, err := findAppPlugin(c, cfg, features, pluginID)
	if err != nil {
		return err
	}

	// The apiserver machinery reports on the server it is building ("Authorization
	// is disabled", "Adding GroupVersion ..."), which says nothing about the spec.
	klog.SetLogger(logr.Discard())

	oas, err := pluginopenapi.Build(plugin, version, pluginopenapi.Options{
		BuildVersion: cfg.BuildVersion,
		// nolint:staticcheck // not yet migrated to OpenFeature
		RegisterProxy: features.IsEnabledGlobally(featuremgmt.FlagApppluginsHandleProxyRequests),
	})
	if err != nil {
		return err
	}

	// Indented, because unlike the HTTP response this output is read and diffed
	// by people.
	out, err := json.MarshalIndent(oas, "", "  ")
	if err != nil {
		return err
	}
	out = append(out, '\n')

	if output == "" {
		_, err = os.Stdout.Write(out)
		return err
	}
	if err := os.WriteFile(output, out, 0600); err != nil {
		return err
	}
	// Title is the group version the spec was rendered for.
	logger.Infof("Wrote %s for %s\n", output, oas.Info.Title)
	return nil
}

// writeOpenAPIArgs reads the plugin target and the output path off the command
// line. The output is also read out of the positional arguments because flag
// parsing stops at the first one, and `write-openapi <plugin> -o spec.json` is
// the natural way to type this.
func writeOpenAPIArgs(c *cli.Context) (target string, output string, err error) {
	output = c.String("output")
	args := c.Args().Slice()
	for i := 0; i < len(args); i++ {
		arg := args[i]
		switch {
		case arg == "-o" || arg == "--output":
			if i+1 >= len(args) {
				return "", "", fmt.Errorf("missing value for %s", arg)
			}
			output = args[i+1]
			i++
		case strings.HasPrefix(arg, "-o=") || strings.HasPrefix(arg, "--output="):
			_, output, _ = strings.Cut(arg, "=")
		case strings.HasPrefix(arg, "-"):
			return "", "", fmt.Errorf("unknown flag %q", arg)
		case target == "":
			target = arg
		default:
			return "", "", fmt.Errorf("unexpected argument %q", arg)
		}
	}
	if target == "" {
		return "", "", fmt.Errorf("expected <pluginID>[/<version>] as the first argument")
	}
	return target, output, nil
}

// findAppPlugin discovers the plugin the same way the server does, from the
// plugin paths in the config plus the directory the CLI was pointed at.
func findAppPlugin(
	c *cli.Context,
	cfg *setting.Cfg,
	features featuremgmt.FeatureToggles,
	pluginID string,
) (definition.PluginDefinition, error) {
	var empty definition.PluginDefinition

	pluginCfg, err := pluginconfig.ProvidePluginManagementConfig(cfg, setting.ProvideProvider(cfg), features)
	if err != nil {
		return empty, err
	}
	// A plugin under development is often not in the config's plugin paths.
	if dir := c.String("pluginsDir"); dir != "" && !slices.Contains(pluginCfg.PluginsPaths, dir) {
		pluginCfg.PluginsPaths = append(pluginCfg.PluginsPaths, dir)
	}

	defs, err := definition.LoadPluginDefinition(c.Context,
		pluginsources.ProvideService(cfg, pluginCfg),
		definition.Options{
			Filter: func(json plugins.JSONData) bool {
				return json.ID == pluginID && json.Type == plugins.TypeApp
			},
			Schemas:     true,
			AppManifest: true,
		})
	if err != nil {
		return empty, err
	}
	if len(defs) == 0 {
		return empty, fmt.Errorf("app plugin %q was not found in %s",
			pluginID, strings.Join(pluginCfg.PluginsPaths, ", "))
	}
	return defs[0], nil
}
