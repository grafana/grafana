package docker

import (
	"bytes"
	"fmt"
	"strings"
	"text/template"

	"github.com/grafana/grafana/pkg/build/daggerbuild/backend"
	"github.com/grafana/grafana/pkg/build/daggerbuild/packages"
)

type BaseImage int

const (
	BaseImageUbuntu BaseImage = iota
	BaseImageAlpine
)

const (
	DefaultTagFormat       = "{{ .version }}-{{ .arch }}"
	DefaultUbuntuTagFormat = "{{ .version }}-ubuntu-{{ .arch }}"
	DefaultBoringTagFormat = "{{ .version }}-{{ .arch }}-boringcrypto"
	DefaultHGTagFormat     = "{{ .version }}-{{ .arch }}"
)

// Tags returns the name of the grafana docker image based on the tar package name.
// To maintain backwards compatibility, we must keep this the same as it was before.
func Tags(org, registry string, repos []string, format string, tarOpts packages.NameOpts) ([]string, error) {
	tags := make([]string, len(repos))

	for i, repo := range repos {
		tag, err := ImageTag(tarOpts.Distro, format, registry, org, repo, tarOpts.Version, tarOpts.BuildID)
		if err != nil {
			return nil, err
		}

		tags[i] = tag
	}

	return tags, nil
}

func ImageTag(distro backend.Distribution, format, registry, org, repo, version, buildID string) (string, error) {
	version, err := ImageVersion(format, TemplateValues(distro, version, buildID))
	if err != nil {
		return "", err
	}

	return fmt.Sprintf("%s/%s/%s:%s", registry, org, repo, version), nil
}

func ImageVersion(format string, values map[string]string) (string, error) {
	tmpl, err := template.New("version").Parse(format)
	if err != nil {
		return "", err
	}

	buf := bytes.NewBuffer(nil)
	if err := tmpl.Execute(buf, values); err != nil {
		return "", err
	}

	return buf.String(), nil
}

func TemplateValues(distro backend.Distribution, version, buildID string) map[string]string {
	arch := backend.FullArch(distro)
	arch = strings.ReplaceAll(arch, "/", "")
	arch = strings.ReplaceAll(arch, "dynamic", "")
	ersion := strings.TrimPrefix(version, "v")

	semverc := strings.Split(ersion, "-")
	return map[string]string{
		"arch":         arch,
		"version":      ersion,
		"version_base": semverc[0],
		"buildID":      buildID,
	}
}
