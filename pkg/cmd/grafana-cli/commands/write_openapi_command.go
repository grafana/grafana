package commands

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"github.com/go-logr/logr"
	"github.com/urfave/cli/v2"
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/spec3"

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
// serves, without starting Grafana. It uses the same rendering pipeline as
// GET /openapi/v3/apis/{group}/{version} on a running server.
func writeOpenAPICommand(c *cli.Context) error {
	target, output, err := writeOpenAPIArgs(c)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	// The apiserver machinery reports on the server it is building ("Authorization
	// is disabled", "Adding GroupVersion ..."), which says nothing about the spec.
	klog.SetLogger(logr.Discard())

	plugin, version, opts, err := writeOpenAPIInput(c, target, output)
	if err != nil {
		return err
	}

	if version != "" {
		oas, err := pluginopenapi.Build(plugin, version, opts)
		if err != nil {
			return err
		}
		if output == "" {
			return writeSpecTo(os.Stdout, oas)
		}
		return writeSpecFile(output, oas)
	}

	versions, err := pluginopenapi.Versions(plugin, opts)
	if err != nil {
		return err
	}
	if output == "" {
		return cli.Exit(fmt.Sprintf(
			"%s serves %s: pass -o <directory> to write them all, or name one version",
			plugin.JSONData.ID, strings.Join(versions, ", ")), 1)
	}
	if err := ensureOutputDir(output); err != nil {
		return err
	}
	for _, v := range versions {
		oas, err := pluginopenapi.Build(plugin, v, opts)
		if err != nil {
			return err
		}
		if err := writeSpecFile(filepath.Join(output, openAPISpecFilename(plugin, v)), oas); err != nil {
			return err
		}
	}
	return nil
}

func openAPISpecFilename(plugin definition.PluginDefinition, version string) string {
	group := plugin.JSONData.ID
	if plugin.Manifest != nil {
		group = plugin.Manifest.Group
	}
	return group + "-" + version + ".json"
}

// ensureOutputDir prepares the directory the per-version specs are written to.
// A path that names a file is refused rather than turned into a directory: it
// is a caller who meant to write one version and did not say which.
func ensureOutputDir(path string) error {
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		return cli.Exit(fmt.Sprintf("%s is a file; pass a directory to write every version", path), 1)
	}
	if strings.HasSuffix(path, ".json") {
		return cli.Exit(fmt.Sprintf("%s names a file; pass a directory to write every version, or name one version", path), 1)
	}
	return os.MkdirAll(path, 0750)
}

// writeOpenAPIInput resolves the target into the plugin to render, the single
// version to render (empty for all of them), and the options that affect the
// rendered document.
//
// A manifest file is read on its own, with no Grafana config involved, so this
// works in a plugin's build with no Grafana installed. A plugin id is looked up
// the way the server looks it up, which needs the config that says where plugins
// live.
func writeOpenAPIInput(c *cli.Context, target, output string) (definition.PluginDefinition, string, pluginopenapi.Options, error) {
	var empty definition.PluginDefinition

	info, statErr := os.Stat(target)
	if statErr == nil {
		if info.IsDir() {
			return empty, "", pluginopenapi.Options{}, cli.Exit(fmt.Sprintf(
				"%s is a directory; pass the manifest file inside it", target), 1)
		}
		plugin, err := pluginopenapi.LoadManifest(c.Context, target)
		return plugin, "", pluginopenapi.Options{BuildVersion: setting.BuildVersion}, err
	}

	// Preserve the filesystem error for a path. Treating it as a plugin target
	// would report a misleading missing-plugin error instead.
	if looksLikePath(target) {
		return empty, "", pluginopenapi.Options{}, statErr
	}

	pluginID, version, _ := strings.Cut(target, "/")

	args := strings.Split(c.String("configOverrides"), " ")
	if output == "" {
		// Keep configuration logs off stdout when stdout is reserved for the
		// rendered spec. File logging remains enabled by default.
		args = append(args, "cfg:log.mode=file")
	}
	cmd := &utils.ContextCommandLine{Context: c}
	cfg, err := setting.NewCfgFromArgs(setting.CommandLineArgs{
		Config:   cmd.ConfigFile(),
		HomePath: cmd.HomePath(),
		Args:     args,
	})
	if err != nil {
		return definition.PluginDefinition{}, "", pluginopenapi.Options{}, err
	}

	features, err := featuremgmt.ProvideManagerService(cfg)
	if err != nil {
		return definition.PluginDefinition{}, "", pluginopenapi.Options{}, err
	}

	plugin, err := findAppPlugin(c, cfg, features, pluginID)
	return plugin, version, pluginopenapi.Options{
		BuildVersion: cfg.BuildVersion,
		// nolint:staticcheck // not yet migrated to OpenFeature
		RegisterProxy: features.IsEnabledGlobally(featuremgmt.FlagApppluginsHandleProxyRequests),
	}, err
}

// looksLikePath reports whether the target was typed as a file path rather than
// as a plugin id. A plugin id carries a slash too -- pluginID/version -- so the
// slash alone says nothing; a leading dot or separator, or a .json name, does.
func looksLikePath(target string) bool {
	return strings.HasSuffix(target, ".json") ||
		strings.HasPrefix(target, ".") ||
		strings.HasPrefix(target, "~") ||
		strings.HasPrefix(target, string(os.PathSeparator))
}

func writeSpecFile(path string, oas *spec3.OpenAPI) error {
	f, err := os.Create(path) // #nosec G304 -- a path the operator typed
	if err != nil {
		return err
	}
	if err := writeSpecTo(f, oas); err != nil {
		_ = f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}
	logger.Infof("Wrote %s for %s\n", path, oas.Info.Title)
	return nil
}

// writeSpecTo encodes the spec the way a file that people read and diff wants
// it: indented, and without escaping the angle brackets that fill Kubernetes
// descriptions.
func writeSpecTo(w io.Writer, oas *spec3.OpenAPI) error {
	enc := json.NewEncoder(w)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	return enc.Encode(oas)
}

// writeOpenAPIArgs reads the target and the output path off the command line.
// The output is also read out of the positional arguments because flag parsing
// stops at the first one, and `write-openapi <target> -o spec.json` is the
// natural way to type this.
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
		return "", "", fmt.Errorf("expected a manifest file or <pluginID>[/<version>] as the first argument")
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
