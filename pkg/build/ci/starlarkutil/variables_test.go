package starlarkutil_test

import (
	"bytes"
	"testing"

	"github.com/grafana/grafana/pkg/build/ci/starlarkutil"
)

func testStarlarkFile() *bytes.Buffer {
	file := `load('scripts/drone/vault.star', 'from_secret', 'github_token', 'pull_secret', 'drone_token', 'prerelease_bucket')
grabpl_version = 'v2.9.27'
build_image = 'grafana/build-container:1.5.3'
publish_image = 'grafana/grafana-ci-deploy:1.3.1'
deploy_docker_image = 'us.gcr.io/kubernetes-dev/drone/plugins/deploy-image'
alpine_image = 'alpine:3.15'
curl_image = 'byrnedo/alpine-curl:0.1.8'
windows_image = 'mcr.microsoft.com/windows:1809'
wix_image = 'grafana/ci-wix:0.1.1'
test_release_ver = 'v7.3.0-test'

disable_tests = False

def slack_step(channel, template, secret):
    example_variable = 'slack_step'
    example_variable2 = 'don't find meeee'
    return {
        'name': 'slack',
        'image': 'plugins/slack',
        'settings': {
            'webhook': from_secret(secret),
            'channel': channel,
            'template': template,
        },
    }

def initialize_step(edition, platform, ver_mode, is_downstream=False, install_deps=True):
    example_variable = 'initialize_step'
    if platform == 'windows':
        return [
            {
                'name': 'identify-runner',
                'image': windows_image,
                'commands': [
                    'echo $env:DRONE_RUNNER_NAME',
                ],
            },
        ]

    common_cmds = [
        # Generate Go code, will install Wire
        # TODO: Install Wire in Docker image instead
        'make gen-go',
    ]

example_variable = "outside"
  `
	return bytes.NewBuffer([]byte(file))
}

func TestVariable(t *testing.T) {
	t.Run("It should find a variable", func(t *testing.T) {
		file := testStarlarkFile()
		expect := "v2.9.27"
		val, err := starlarkutil.Variable(file, "grabpl_version")
		if err != nil {
			t.Fatal(err)
		}

		if val != expect {
			t.Fatalf("Unexpected response from Variable; expected '%s' but received '%s'", expect, val)
		}
	})
	t.Run("It should only find a top-level (global?) variable", func(t *testing.T) {
		file := testStarlarkFile()
		expect := "outside"
		val, err := starlarkutil.Variable(file, "example_variable")
		if err != nil {
			t.Fatal(err)
		}

		if val != expect {
			t.Fatalf("Unexpected response from Variable; expected '%s' but received '%s'", expect, val)
		}
	})
	t.Run("It should not find variables in a function", func(t *testing.T) {
		file := testStarlarkFile()
		val, err := starlarkutil.Variable(file, "example_variable2")
		if err == nil {
			t.Fatalf("expected error from Variable but did not receive one. Received value '%s' instead", val)
		}
	})
	t.Run("It should not find variables that ain't there", func(t *testing.T) {
		file := testStarlarkFile()
		val, err := starlarkutil.Variable(file, "not_there")
		if err == nil {
			t.Fatalf("expected error from Variable but did not receive one. Received value '%s' instead", val)
		}
	})
}
