package commands

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-logr/logr"
	"github.com/urfave/cli/v2"
	"k8s.io/klog/v2"
	"k8s.io/kube-openapi/pkg/spec3"

	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/registry/apis/appplugin/pluginopenapi"
	"github.com/grafana/grafana/pkg/setting"
)

// writeOpenAPICommand renders the OpenAPI v3 spec an app plugin's API server
// serves, without starting Grafana. It uses the same rendering pipeline as
// GET /openapi/v3/apis/{group}/{version} on a running server.
func writeOpenAPICommand(c *cli.Context) error {
	target, output, version, err := writeOpenAPIArgs(c)
	if err != nil {
		return cli.Exit(err.Error(), 1)
	}

	// The apiserver machinery reports on the server it is building ("Authorization
	// is disabled", "Adding GroupVersion ..."), which says nothing about the spec.
	klog.SetLogger(logr.Discard())

	info, err := os.Stat(target)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return cli.Exit(fmt.Sprintf("%s is a directory; pass the manifest file inside it", target), 1)
	}
	plugin, err := pluginopenapi.LoadManifest(c.Context, target)
	if err != nil {
		return err
	}

	opts := pluginopenapi.Options{BuildVersion: setting.BuildVersion}
	manifest := plugin.Manifests[0]
	if version != "" {
		oas, err := pluginopenapi.Build(plugin, version, opts)
		if err != nil {
			return err
		}
		if output == "" {
			return writeSpecTo(c.App.Writer, oas)
		}
		return writeSpecFile(output, oas)
	}

	versions, err := pluginopenapi.Versions(plugin, opts)
	if err != nil {
		return err
	}
	if len(versions) == 0 {
		return fmt.Errorf("manifest %q has no served versions", target)
	}
	if output == "" {
		return cli.Exit(fmt.Sprintf(
			"%s serves %s: pass -o <directory> to write them all, or select one with --api-version",
			manifest.Group, strings.Join(versions, ", ")), 1)
	}
	if err := ensureOutputDir(output); err != nil {
		return err
	}
	for _, v := range versions {
		oas, err := pluginopenapi.Build(plugin, v, opts)
		if err != nil {
			return err
		}
		if err := writeSpecFile(filepath.Join(output, manifest.Group+"-"+v+".json"), oas); err != nil {
			return err
		}
	}
	return nil
}

// ensureOutputDir prepares the directory the per-version specs are written to.
// A path that names a file is refused rather than turned into a directory: it
// is a caller who meant to write one version and did not say which.
func ensureOutputDir(path string) error {
	if info, err := os.Stat(path); err == nil && !info.IsDir() {
		return cli.Exit(fmt.Sprintf("%s is a file; pass a directory to write every version", path), 1)
	}
	if strings.HasSuffix(path, ".json") {
		return cli.Exit(fmt.Sprintf("%s names a file; pass a directory to write every version, or select one with --api-version", path), 1)
	}
	return os.MkdirAll(path, 0750)
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
func writeOpenAPIArgs(c *cli.Context) (target, output, version string, err error) {
	output, version = c.String("output"), c.String("api-version")
	args := c.Args().Slice()
	for i := 0; i < len(args); i++ {
		arg := args[i]
		name, value, hasValue := strings.Cut(arg, "=")
		switch name {
		case "-o", "--output", "--api-version":
			if !hasValue {
				if i+1 >= len(args) || strings.HasPrefix(args[i+1], "-") {
					return "", "", "", fmt.Errorf("missing value for %s", name)
				}
				i++
				value = args[i]
			}
			if value == "" {
				return "", "", "", fmt.Errorf("missing value for %s", name)
			}
			if name == "--api-version" {
				version = value
			} else {
				output = value
			}
		default:
			if strings.HasPrefix(arg, "-") {
				return "", "", "", fmt.Errorf("unknown flag %q", arg)
			}
			if target != "" {
				return "", "", "", fmt.Errorf("unexpected argument %q", arg)
			}
			target = arg
		}
	}
	if target == "" {
		return "", "", "", fmt.Errorf("expected a manifest file as the first argument")
	}
	return target, output, version, nil
}
