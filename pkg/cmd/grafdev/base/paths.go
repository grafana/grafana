package base

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const grafanaGoModModule = "github.com/grafana/grafana"

// RepoPaths holds resolved OSS and Enterprise repository roots.
type RepoPaths struct {
	OSS        string
	Enterprise string
}

// ResolveRepos finds OSS (this Grafana checkout) and the sibling grafana-enterprise tree.
func ResolveRepos(ossFlag, entFlag string) (RepoPaths, error) {
	oss, err := resolveOSSRoot(ossFlag)
	if err != nil {
		return RepoPaths{}, err
	}
	ent := strings.TrimSpace(entFlag)
	if ent == "" {
		ent = strings.TrimSpace(os.Getenv("GRAFANA_DEV_ENTERPRISE"))
	}
	if ent == "" {
		ent = filepath.Join(filepath.Dir(oss), "grafana-enterprise")
	}
	ent, err = filepath.Abs(ent)
	if err != nil {
		return RepoPaths{}, fmt.Errorf("enterprise path: %w", err)
	}
	return RepoPaths{OSS: oss, Enterprise: ent}, nil
}

func resolveOSSRoot(flag string) (string, error) {
	if flag != "" {
		abs, err := filepath.Abs(flag)
		if err != nil {
			return "", err
		}
		if err := assertGrafanaModule(abs); err != nil {
			return "", err
		}
		return abs, nil
	}
	if env := strings.TrimSpace(os.Getenv("GRAFANA_DEV_OSS")); env != "" {
		abs, err := filepath.Abs(env)
		if err != nil {
			return "", err
		}
		if err := assertGrafanaModule(abs); err != nil {
			return "", err
		}
		return abs, nil
	}
	wd, err := os.Getwd()
	if err != nil {
		return "", err
	}
	cur := wd
	for {
		if err := assertGrafanaModule(cur); err == nil {
			return filepath.Abs(cur)
		}
		parent := filepath.Dir(cur)
		if parent == cur {
			break
		}
		cur = parent
	}
	return "", fmt.Errorf("could not locate Grafana OSS checkout (missing go.mod with module %s); use --oss or set GRAFANA_DEV_OSS", grafanaGoModModule)
}

func assertGrafanaModule(dir string) error {
	data, err := os.ReadFile(filepath.Join(dir, "go.mod"))
	if err != nil {
		return err
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "module ") {
			mod := strings.TrimSpace(strings.TrimPrefix(line, "module "))
			if mod == grafanaGoModModule {
				return nil
			}
			return fmt.Errorf("go.mod module is %q, expected %s", mod, grafanaGoModModule)
		}
	}
	return errors.New("go.mod has no module line")
}

func (p RepoPaths) LocalMakefile() string {
	return filepath.Join(p.OSS, "local", "Makefile")
}

func (p RepoPaths) EnterpriseDevLock() string {
	return filepath.Join(p.Enterprise, ".devlock")
}

func (p RepoPaths) EnterpriseImportsGo() string {
	return filepath.Join(p.OSS, "pkg", "extensions", "enterprise_imports.go")
}

func (p RepoPaths) ExtGo() string {
	return filepath.Join(p.OSS, "pkg", "extensions", "ext.go")
}
