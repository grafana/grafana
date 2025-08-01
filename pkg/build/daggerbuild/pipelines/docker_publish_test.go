package pipelines_test

import (
	"testing"

	"github.com/grafana/grafana/pkg/build/daggerbuild/pipelines"
)

func TestImageManifest(t *testing.T) {
	manifests := map[string]string{
		"docker.io/grafana/grafana-image-tags:1.2.3-test.1.2.3-amd64":                   "docker.io/grafana/grafana:1.2.3-test.1.2.3",
		"docker.io/grafana/grafana-oss-image-tags:1.2.3-test.1.2.3-amd64":               "docker.io/grafana/grafana-oss:1.2.3-test.1.2.3",
		"docker.io/grafana/grafana-image-tags:1.2.3-test.1.2.3-arm64":                   "docker.io/grafana/grafana:1.2.3-test.1.2.3",
		"docker.io/grafana/grafana-oss-image-tags:1.2.3-test.1.2.3-arm64":               "docker.io/grafana/grafana-oss:1.2.3-test.1.2.3",
		"docker.io/grafana/grafana-image-tags:1.2.3-test.1.2.3-ubuntu-amd64":            "docker.io/grafana/grafana:1.2.3-test.1.2.3-ubuntu",
		"docker.io/grafana/grafana-oss-image-tags:1.2.3-test.1.2.3-ubuntu-amd64":        "docker.io/grafana/grafana-oss:1.2.3-test.1.2.3-ubuntu",
		"docker.io/grafana/grafana-image-tags:1.2.3-test.1.2.3-ubuntu-arm64":            "docker.io/grafana/grafana:1.2.3-test.1.2.3-ubuntu",
		"docker.io/grafana/grafana-oss-image-tags:1.2.3-test.1.2.3-ubuntu-arm64":        "docker.io/grafana/grafana-oss:1.2.3-test.1.2.3-ubuntu",
		"docker.io/grafana/grafana-enterprise-image-tags:1.2.3-test.1.2.3-amd64":        "docker.io/grafana/grafana-enterprise:1.2.3-test.1.2.3",
		"docker.io/grafana/grafana-enterprise-image-tags:1.2.3-test.1.2.3-arm64":        "docker.io/grafana/grafana-enterprise:1.2.3-test.1.2.3",
		"docker.io/grafana/grafana-enterprise-image-tags:1.2.3-test.1.2.3-ubuntu-amd64": "docker.io/grafana/grafana-enterprise:1.2.3-test.1.2.3-ubuntu",
		"docker.io/grafana/grafana-enterprise-image-tags:1.2.3-test.1.2.3-ubuntu-arm64": "docker.io/grafana/grafana-enterprise:1.2.3-test.1.2.3-ubuntu",
	}

	for k, v := range manifests {
		if n := pipelines.ImageManifest(k); n != v {
			t.Errorf("Expected '%s' manifest to equal '%s' but got '%s'", k, v, n)
		}
	}
}

func TestLatestManifest(t *testing.T) {
	manifests := map[string]string{
		"docker.io/grafana/grafana-image-tags:1.2.3-test.1.2.3-amd64":                   "docker.io/grafana/grafana:latest",
		"docker.io/grafana/grafana-oss-image-tags:1.2.3-test.1.2.3-amd64":               "docker.io/grafana/grafana-oss:latest",
		"docker.io/grafana/grafana-image-tags:1.2.3-test.1.2.3-arm64":                   "docker.io/grafana/grafana:latest",
		"docker.io/grafana/grafana-oss-image-tags:1.2.3-test.1.2.3-arm64":               "docker.io/grafana/grafana-oss:latest",
		"docker.io/grafana/grafana-image-tags:1.2.3-test.1.2.3-ubuntu-amd64":            "docker.io/grafana/grafana:latest-ubuntu",
		"docker.io/grafana/grafana-oss-image-tags:1.2.3-test.1.2.3-ubuntu-amd64":        "docker.io/grafana/grafana-oss:latest-ubuntu",
		"docker.io/grafana/grafana-image-tags:1.2.3-test.1.2.3-ubuntu-arm64":            "docker.io/grafana/grafana:latest-ubuntu",
		"docker.io/grafana/grafana-oss-image-tags:1.2.3-test.1.2.3-ubuntu-arm64":        "docker.io/grafana/grafana-oss:latest-ubuntu",
		"docker.io/grafana/grafana-enterprise-image-tags:1.2.3-test.1.2.3-amd64":        "docker.io/grafana/grafana-enterprise:latest",
		"docker.io/grafana/grafana-enterprise-image-tags:1.2.3-test.1.2.3-arm64":        "docker.io/grafana/grafana-enterprise:latest",
		"docker.io/grafana/grafana-enterprise-image-tags:1.2.3-test.1.2.3-ubuntu-amd64": "docker.io/grafana/grafana-enterprise:latest-ubuntu",
		"docker.io/grafana/grafana-enterprise-image-tags:1.2.3-test.1.2.3-ubuntu-arm64": "docker.io/grafana/grafana-enterprise:latest-ubuntu",
	}

	for k, v := range manifests {
		if n := pipelines.LatestManifest(k); n != v {
			t.Errorf("Expected '%s' manifest to equal '%s' but got '%s'", k, v, n)
		}
	}
}
