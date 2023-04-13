"""
This module is a library of Drone steps and other pipeline components.
"""

load(
    "scripts/drone/vault.star",
    "from_secret",
    "prerelease_bucket",
)

grabpl_version = "v3.0.30"
build_image = "grafana/build-container:1.7.2"
publish_image = "grafana/grafana-ci-deploy:1.3.3"
deploy_docker_image = "us.gcr.io/kubernetes-dev/drone/plugins/deploy-image"
alpine_image = "alpine:3.17.1"
curl_image = "byrnedo/alpine-curl:0.1.8"
windows_image = "mcr.microsoft.com/windows:1809"
wix_image = "grafana/ci-wix:0.1.1"
go_image = "golang:1.20.1"

trigger_oss = {
    "repo": [
        "grafana/grafana",
    ],
}

def slack_step(channel, template, secret):
    return {
        "name": "slack",
        "image": "plugins/slack",
        "settings": {
            "webhook": from_secret(secret),
            "channel": channel,
            "template": template,
        },
    }

def yarn_install_step():
    return {
        "name": "yarn-install",
        "image": build_image,
        "commands": [
            "yarn install --immutable",
        ],
        "depends_on": [],
    }

def wire_install_step():
    return {
        "name": "wire-install",
        "image": build_image,
        "commands": [
            "make gen-go",
        ],
        "depends_on": [
            "verify-gen-cue",
        ],
    }

def identify_runner_step(platform = "linux"):
    if platform == "linux":
        return {
            "name": "identify-runner",
            "image": alpine_image,
            "commands": [
                "echo $DRONE_RUNNER_NAME",
            ],
        }
    else:
        return {
            "name": "identify-runner",
            "image": windows_image,
            "commands": [
                "echo $env:DRONE_RUNNER_NAME",
            ],
        }

def enterprise_setup_step(source = "${DRONE_SOURCE_BRANCH}", canFail = True):
    step = clone_enterprise_step_pr(source = source, target = "${DRONE_TARGET_BRANCH}", canFail = canFail, location = "../grafana-enterprise")
    step["commands"] += [
        "cd ../",
        "ln -s src grafana",
        "cd ./grafana-enterprise",
        "./build.sh",
    ]

    return step

def clone_enterprise_step(source = "${DRONE_COMMIT}"):
    """Clone the enterprise source into the ./grafana-enterprise directory.

    Args:
      source: controls which revision of grafana-enterprise is checked out, if it exists. The name 'source' derives from the 'source branch' of a pull request.
    Returns:
      Drone step.
    """
    step = {
        "name": "clone-enterprise",
        "image": build_image,
        "environment": {
            "GITHUB_TOKEN": from_secret("github_token"),
        },
        "commands": [
            'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git"',
            "cd grafana-enterprise",
            "git checkout {}".format(source),
        ],
    }

    return step

def clone_enterprise_step_pr(source = "${DRONE_COMMIT}", target = "main", canFail = False, location = "grafana-enterprise"):
    """Clone the enterprise source into the ./grafana-enterprise directory.

    Args:
      source: controls which revision of grafana-enterprise is checked out, if it exists. The name 'source' derives from the 'source branch' of a pull request.
      target: controls which revision of grafana-enterprise is checked out, if it 'source' does not exist. The name 'target' derives from the 'target branch' of a pull request. If this does not exist, then 'main' will be checked out.
      canFail: controls whether or not this step is allowed to fail. If it fails and this is true, then the pipeline will continue. canFail is used in pull request pipelines where enterprise may be cloned but may not clone in forks.
      location: the path where grafana-enterprise is cloned.
    Returns:
      Drone step.
    """
    step = {
        "name": "clone-enterprise",
        "image": build_image,
        "environment": {
            "GITHUB_TOKEN": from_secret("github_token"),
        },
        "commands": [
            'is_fork=$(curl "https://$GITHUB_TOKEN@api.github.com/repos/grafana/grafana/pulls/$DRONE_PULL_REQUEST" | jq .head.repo.fork)',
            'if [ "$is_fork" != false ]; then return 1; fi',  # Only clone if we're confident that 'fork' is 'false'. Fail if it's also empty.
            'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git" ' + location,
            "cd {}".format(location),
            'if git checkout {0}; then echo "checked out {0}"; elif git checkout {1}; then echo "git checkout {1}"; else git checkout main; fi'.format(source, target),
        ],
    }

    if canFail:
        step["failure"] = "ignore"

    return step

def init_enterprise_step(ver_mode):
    """Adds the enterprise deployment configuration into the source directory.

    Args:
      ver_mode: controls what revision of the OSS source to use.
        If ver_mode is 'release', the step uses the tagged revision.
        Otherwise, the DRONE_SOURCE_BRANCH is used.

    Returns:
      Drone step.
    """
    source_commit = ""
    if ver_mode == "release":
        source_commit = " ${DRONE_TAG}"
        environment = {
            "GITHUB_TOKEN": from_secret("github_token"),
        }
        token = "--github-token $${GITHUB_TOKEN}"
    elif ver_mode == "release-branch":
        environment = {
            "GITHUB_TOKEN": from_secret("github_token"),
        }
        token = "--github-token $${GITHUB_TOKEN}"
    else:
        environment = {}
        token = ""
    return {
        "name": "init-enterprise",
        "image": build_image,
        "depends_on": [
            "clone-enterprise",
            "grabpl",
        ],
        "environment": environment,
        "commands": [
            "mv bin/grabpl /tmp/",
            "rmdir bin",
            "mv grafana-enterprise /tmp/",
            "/tmp/grabpl init-enterprise {} /tmp/grafana-enterprise{}".format(
                token,
                source_commit,
            ).rstrip(),
            "mv /tmp/grafana-enterprise/deployment_tools_config.json deployment_tools_config.json",
            "mkdir bin",
            "mv /tmp/grabpl bin/",
        ],
    }

def download_grabpl_step(platform = "linux"):
    if platform == "windows":
        return {
            "name": "grabpl",
            "image": wix_image,
            "commands": [
                '$$ProgressPreference = "SilentlyContinue"',
                "Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe".format(
                    grabpl_version,
                ),
            ],
        }

    return {
        "name": "grabpl",
        "image": curl_image,
        "commands": [
            "mkdir -p bin",
            "curl -fL -o bin/grabpl https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/grabpl".format(
                grabpl_version,
            ),
            "chmod +x bin/grabpl",
        ],
    }

def lint_drone_step():
    return {
        "name": "lint-drone",
        "image": curl_image,
        "commands": [
            "./bin/build verify-drone",
        ],
        "depends_on": [
            "compile-build-cmd",
        ],
    }

def lint_starlark_step():
    return {
        "name": "lint-starlark",
        "image": build_image,
        "commands": [
            "./bin/build verify-starlark .",
        ],
        "depends_on": [
            "compile-build-cmd",
        ],
    }

def enterprise_downstream_step(ver_mode):
    """Triggers a downstream pipeline in the grafana-enterprise repository.

    Args:
      ver_mode: indirectly controls the revision used for downstream pipelines.
        It also used to allow the step to fail for pull requests without blocking merging.

    Returns:
      Drone step.
    """
    repo = "grafana/grafana-enterprise@"
    if ver_mode == "pr":
        repo += "${DRONE_SOURCE_BRANCH}"
    else:
        repo += "main"

    step = {
        "name": "trigger-enterprise-downstream",
        "image": "grafana/drone-downstream",
        "settings": {
            "server": "https://drone.grafana.net",
            "token": from_secret("drone_token"),
            "repositories": [
                repo,
            ],
            "params": [
                "SOURCE_BUILD_NUMBER=${DRONE_COMMIT}",
                "SOURCE_COMMIT=${DRONE_COMMIT}",
            ],
        },
    }

    if ver_mode == "pr":
        step.update({"failure": "ignore"})
        step["settings"]["params"].append("OSS_PULL_REQUEST=${DRONE_PULL_REQUEST}")

    return step

def lint_backend_step():
    return {
        "name": "lint-backend",
        # TODO: build_image or go_image?
        "image": go_image,
        "environment": {
            # We need CGO because of go-sqlite3
            "CGO_ENABLED": "1",
        },
        "depends_on": [
            "wire-install",
        ],
        "commands": [
            "apt-get update && apt-get install make",
            # Don't use Make since it will re-download the linters
            "make lint-go",
        ],
    }

def benchmark_ldap_step():
    return {
        "name": "benchmark-ldap",
        "image": build_image,
        "environment": {
            "LDAP_HOSTNAME": "ldap",
        },
        "commands": [
            "dockerize -wait tcp://ldap:389 -timeout 120s",
            'go test -benchmem -run=^$ ./pkg/extensions/ldapsync -bench "^(Benchmark50Users)$"',
        ],
    }

def build_storybook_step(ver_mode):
    return {
        "name": "build-storybook",
        "image": build_image,
        "depends_on": [
            # Best to ensure that this step doesn't mess with what's getting built and packaged
            "build-frontend",
            "build-frontend-packages",
        ],
        "environment": {
            "NODE_OPTIONS": "--max_old_space_size=4096",
        },
        "commands": [
            "yarn storybook:build",
            "./bin/build verify-storybook",
        ],
        "when": get_trigger_storybook(ver_mode),
    }

def store_storybook_step(ver_mode, trigger = None):
    """Publishes the Grafana UI components storybook.

    Args:
      ver_mode: controls whether a release or canary version is published.
      trigger: a Drone trigger for the step.
        Defaults to None.

    Returns:
      Drone step.
    """
    commands = []
    if ver_mode == "release":
        commands.extend(
            [
                "./bin/build store-storybook --deployment latest",
                "./bin/build store-storybook --deployment ${DRONE_TAG}",
            ],
        )

    else:
        # main pipelines should deploy storybook to grafana-storybook/canary public bucket
        commands = [
            "./bin/build store-storybook --deployment canary",
        ]

    step = {
        "name": "store-storybook",
        "image": publish_image,
        "depends_on": [
                          "build-storybook",
                      ] +
                      end_to_end_tests_deps(),
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
        },
        "commands": commands,
        "when": get_trigger_storybook(ver_mode),
    }
    if trigger and ver_mode in ("release-branch", "main"):
        # no dict merge operation available, https://github.com/harness/drone-cli/pull/220
        when_cond = {
            "repo": [
                "grafana/grafana",
            ],
            "paths": {
                "include": [
                    "packages/grafana-ui/**",
                ],
            },
        }
        step = dict(step, when = when_cond)
    return step

def e2e_tests_artifacts():
    return {
        "name": "e2e-tests-artifacts-upload",
        "image": "google/cloud-sdk:406.0.0",
        "depends_on": [
            "end-to-end-tests-dashboards-suite",
            "end-to-end-tests-panels-suite",
            "end-to-end-tests-smoke-tests-suite",
            "end-to-end-tests-various-suite",
        ],
        "failure": "ignore",
        "when": {
            "status": [
                "success",
                "failure",
            ],
        },
        "environment": {
            "GCP_GRAFANA_UPLOAD_ARTIFACTS_KEY": from_secret("gcp_upload_artifacts_key"),
            "E2E_TEST_ARTIFACTS_BUCKET": "releng-pipeline-artifacts-dev",
            "GITHUB_TOKEN": from_secret("github_token"),
        },
        "commands": [
            "apt-get update",
            "apt-get install -yq zip",
            "printenv GCP_GRAFANA_UPLOAD_ARTIFACTS_KEY > /tmp/gcpkey_upload_artifacts.json",
            "gcloud auth activate-service-account --key-file=/tmp/gcpkey_upload_artifacts.json",
            # we want to only include files in e2e folder that end with .spec.ts.mp4
            'find ./e2e -type f -name "*spec.ts.mp4" | zip e2e/videos.zip -@',
            "gsutil cp e2e/videos.zip gs://$${E2E_TEST_ARTIFACTS_BUCKET}/${DRONE_BUILD_NUMBER}/artifacts/videos/videos.zip",
            "export E2E_ARTIFACTS_VIDEO_ZIP=https://storage.googleapis.com/$${E2E_TEST_ARTIFACTS_BUCKET}/${DRONE_BUILD_NUMBER}/artifacts/videos/videos.zip",
            'echo "E2E Test artifacts uploaded to: $${E2E_ARTIFACTS_VIDEO_ZIP}"',
            'curl -X POST https://api.github.com/repos/${DRONE_REPO}/statuses/${DRONE_COMMIT_SHA} -H "Authorization: token $${GITHUB_TOKEN}" -d ' +
            '"{\\"state\\":\\"success\\",\\"target_url\\":\\"$${E2E_ARTIFACTS_VIDEO_ZIP}\\", \\"description\\": \\"Click on the details to download e2e recording videos\\", \\"context\\": \\"e2e_artifacts\\"}"',
        ],
    }

def upload_cdn_step(edition, ver_mode, trigger = None):
    """Uploads CDN assets using the Grafana build tool.

    Args:
      edition: controls the output directory for the CDN assets.
      ver_mode: only uses the step trigger when ver_mode == 'release-branch' or 'main'
      trigger: a Drone trigger for the step.
        Defaults to None.

    Returns:
      Drone step.
    """
    deps = []
    if edition in "enterprise2":
        deps.extend(
            [
                "package" + enterprise2_suffix(edition),
            ],
        )
    else:
        deps.extend(
            [
                "grafana-server",
            ],
        )

    step = {
        "name": "upload-cdn-assets" + enterprise2_suffix(edition),
        "image": publish_image,
        "depends_on": deps,
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
        },
        "commands": [
            "./bin/build upload-cdn --edition {}".format(edition),
        ],
    }
    if trigger and ver_mode in ("release-branch", "main"):
        step = dict(step, when = trigger)
    return step

def build_backend_step(edition, ver_mode, variants = None):
    """Build the backend code using the Grafana build tool.

    Args:
      edition: controls which edition of the backend is built.
      ver_mode: if ver_mode != 'release', pass the DRONE_BUILD_NUMBER environment
        variable as the value for the --build-id option.
        TODO: is this option actually used by the build-backend subcommand?
      variants: a list of variants be passed to the build-backend subcommand
        using the --variants option.
        Defaults to None.

    Returns:
      Drone step.
    """
    variants_str = ""
    if variants:
        variants_str = " --variants {}".format(",".join(variants))

    # TODO: Convert number of jobs to percentage
    if ver_mode == "release":
        cmds = [
            "./bin/build build-backend --jobs 8 --edition {} ${{DRONE_TAG}}".format(
                edition,
            ),
        ]
    else:
        build_no = "${DRONE_BUILD_NUMBER}"
        cmds = [
            "./bin/build build-backend --jobs 8 --edition {} --build-id {}{}".format(
                edition,
                build_no,
                variants_str,
            ),
        ]

    return {
        "name": "build-backend" + enterprise2_suffix(edition),
        "image": build_image,
        "depends_on": [
            "wire-install",
            "compile-build-cmd",
        ],
        "commands": cmds,
    }

def build_frontend_step(edition, ver_mode):
    """Build the frontend code using the Grafana build tool.

    Args:
      edition: controls which edition of the frontend is built.
      ver_mode: if ver_mode != 'release', use the DRONE_BUILD_NUMBER environment
        variable as a build identifier.

    Returns:
      Drone step.
    """
    build_no = "${DRONE_BUILD_NUMBER}"

    # TODO: Use percentage for num jobs
    if ver_mode == "release":
        cmds = [
            "./bin/build build-frontend --jobs 8 " +
            "--edition {} ${{DRONE_TAG}}".format(edition),
        ]
    else:
        cmds = [
            "./bin/build build-frontend --jobs 8 --edition {} ".format(edition) +
            "--build-id {}".format(build_no),
        ]

    return {
        "name": "build-frontend",
        "image": build_image,
        "environment": {
            "NODE_OPTIONS": "--max_old_space_size=8192",
        },
        "depends_on": [
            "compile-build-cmd",
            "yarn-install",
        ],
        "commands": cmds,
    }

def build_frontend_package_step(edition, ver_mode):
    """Build the frontend packages using the Grafana build tool.

    Args:
      edition: controls which edition of the frontend is built.
      ver_mode: if ver_mode != 'release', use the DRONE_BUILD_NUMBER environment
        variable as a build identifier.

    Returns:
      Drone step.
    """
    build_no = "${DRONE_BUILD_NUMBER}"

    # TODO: Use percentage for num jobs
    if ver_mode == "release":
        cmds = [
            "./bin/build build-frontend-packages --jobs 8 " +
            "--edition {} ${{DRONE_TAG}}".format(edition),
        ]
    else:
        cmds = [
            "./bin/build build-frontend-packages --jobs 8 --edition {} ".format(edition) +
            "--build-id {}".format(build_no),
        ]

    return {
        "name": "build-frontend-packages",
        "image": build_image,
        "environment": {
            "NODE_OPTIONS": "--max_old_space_size=8192",
        },
        "depends_on": [
            "compile-build-cmd",
            "yarn-install",
        ],
        "commands": cmds,
    }

def build_plugins_step(edition, ver_mode):
    if ver_mode != "pr":
        env = {
            "GRAFANA_API_KEY": from_secret("grafana_api_key"),
        }
    else:
        env = None
    return {
        "name": "build-plugins",
        "image": build_image,
        "environment": env,
        "depends_on": [
            "compile-build-cmd",
            "yarn-install",
        ],
        "commands": [
            # TODO: Use percentage for num jobs
            "./bin/build  build-plugins --jobs 8 --edition {}".format(edition),
        ],
    }

def test_backend_step():
    return {
        "name": "test-backend",
        "image": build_image,
        "depends_on": [
            "wire-install",
        ],
        "commands": [
            "go test -tags requires_buildifer -short -covermode=atomic -timeout=5m ./pkg/...",
        ],
    }

def test_backend_integration_step():
    return {
        "name": "test-backend-integration",
        "image": build_image,
        "depends_on": [
            "wire-install",
        ],
        "commands": [
            "go test -run Integration -covermode=atomic -timeout=5m ./pkg/...",
        ],
    }

def betterer_frontend_step(edition = "oss"):
    """Run betterer on frontend code.

    Args:
      edition: controls whether enterprise code is also included in the source.
        Defaults to 'oss'.

    Returns:
      Drone step.
    """
    deps = []
    if edition == "enterprise":
        deps.extend(["init-enterprise"])
    deps.extend(["yarn-install"])
    return {
        "name": "betterer-frontend",
        "image": build_image,
        "depends_on": deps,
        "commands": [
            "yarn betterer ci",
        ],
    }

def test_frontend_step(edition = "oss"):
    """Runs tests on frontend code.

    Args:
      edition: controls whether enterprise code is also included in the source.
        Defaults to 'oss'.

    Returns:
      Drone step.
    """
    deps = []
    if edition == "enterprise":
        deps.extend(["init-enterprise"])
    deps.extend(["yarn-install"])
    return {
        "name": "test-frontend",
        "image": build_image,
        "environment": {
            "TEST_MAX_WORKERS": "50%",
        },
        "depends_on": deps,
        "commands": [
            "yarn run ci:test-frontend",
        ],
    }

def lint_frontend_step():
    return {
        "name": "lint-frontend",
        "image": build_image,
        "environment": {
            "TEST_MAX_WORKERS": "50%",
        },
        "depends_on": [
            "yarn-install",
        ],
        "commands": [
            "yarn run prettier:check",
            "yarn run lint",
            "yarn run i18n:compile",  # TODO: right place for this?
            "yarn run typecheck",
        ],
    }

def test_a11y_frontend_step(ver_mode, port = 3001):
    """Runs automated accessiblity tests against the frontend.

    Args:
      ver_mode: controls whether the step is blocking or just reporting.
        If ver_mode == 'pr', the step causes the pipeline to fail.
      port: which port to grafana-server is expected to be listening on.
        Defaults to 3001.

    Returns:
      Drone step.
    """
    commands = [
        "yarn wait-on http://$HOST:$PORT",
    ]
    failure = "ignore"
    if ver_mode == "pr":
        commands.extend(
            [
                "pa11y-ci --config .pa11yci-pr.conf.js",
            ],
        )
        failure = "always"
    else:
        commands.extend(
            [
                "pa11y-ci --config .pa11yci.conf.js --json > pa11y-ci-results.json",
            ],
        )

    return {
        "name": "test-a11y-frontend",
        # TODO which image should be used?
        "image": "grafana/docker-puppeteer:1.1.0",
        "depends_on": [
            "grafana-server",
        ],
        "environment": {
            "GRAFANA_MISC_STATS_API_KEY": from_secret("grafana_misc_stats_api_key"),
            "HOST": "grafana-server",
            "PORT": port,
        },
        "failure": failure,
        "commands": commands,
    }

def frontend_metrics_step(trigger = None):
    """Reports frontend metrics to Grafana Cloud.

    Args:
      trigger: a Drone trigger for the step.
        Defaults to None.

    Returns:
      Drone step.
    """
    step = {
        "name": "publish-frontend-metrics",
        "image": build_image,
        "depends_on": [
            "test-a11y-frontend",
        ],
        "environment": {
            "GRAFANA_MISC_STATS_API_KEY": from_secret("grafana_misc_stats_api_key"),
        },
        "failure": "ignore",
        "commands": [
            "./scripts/ci-frontend-metrics.sh | ./bin/build publish-metrics $${GRAFANA_MISC_STATS_API_KEY}",
        ],
    }
    if trigger:
        step = dict(step, when = trigger)
    return step

def codespell_step():
    return {
        "name": "codespell",
        "image": build_image,
        "commands": [
            # Important: all words have to be in lowercase, and separated by "\n".
            'echo -e "unknwon\nreferer\nerrorstring\neror\niam\nwan" > words_to_ignore.txt',
            "codespell -I words_to_ignore.txt docs/",
            "rm words_to_ignore.txt",
        ],
    }

def package_step(edition, ver_mode):
    """Packages Grafana with the Grafana build tool.

    Args:
      edition: controls which edition of Grafana is packaged.
      ver_mode: controls whether the packages are signed for a release.
        If ver_mode != 'release', use the DRONE_BUILD_NUMBER environment
        variable as a build identifier.

    Returns:
      Drone step.
    """
    deps = [
        "build-plugins",
        "build-backend" + enterprise2_suffix(edition),
        "build-frontend",
        "build-frontend-packages",
    ]

    if ver_mode in ("main", "release", "release-branch"):
        sign_args = " --sign"
        env = {
            "GRAFANA_API_KEY": from_secret("grafana_api_key"),
            "GPG_PRIV_KEY": from_secret("packages_gpg_private_key"),
            "GPG_PUB_KEY": from_secret("packages_gpg_public_key"),
            "GPG_KEY_PASSWORD": from_secret("packages_gpg_passphrase"),
        }
        test_args = ""
    else:
        sign_args = ""
        env = None

        # TODO: env vars no longer needed by build if not signing
        test_args = ". scripts/build/gpg-test-vars.sh && "

    # TODO: Use percentage for jobs
    if ver_mode == "release":
        cmds = [
            "{}./bin/build package --jobs 8 --edition {} ".format(test_args, edition) +
            "{} ${{DRONE_TAG}}".format(sign_args),
        ]
    else:
        build_no = "${DRONE_BUILD_NUMBER}"
        cmds = [
            "{}./bin/build package --jobs 8 --edition {} ".format(test_args, edition) +
            "--build-id {}{}".format(build_no, sign_args),
        ]

    return {
        "name": "package" + enterprise2_suffix(edition),
        "image": build_image,
        "depends_on": deps,
        "environment": env,
        "commands": cmds,
    }

def grafana_server_step(edition, port = 3001):
    """Runs the grafana-server binary as a service.

    Args:
      edition: controls which edition of grafana-server to run.
      port: port to listen on.
        Defaults to 3001.

    Returns:
      Drone step.
    """
    environment = {"PORT": port, "ARCH": "linux-amd64"}
    if edition == "enterprise":
        environment["RUNDIR"] = "scripts/grafana-server/tmp-grafana-enterprise"

    return {
        "name": "grafana-server",
        "image": build_image,
        "detach": True,
        "depends_on": [
            "build-plugins",
            "build-backend",
            "build-frontend",
            "build-frontend-packages",
        ],
        "environment": environment,
        "commands": [
            "./scripts/grafana-server/start-server",
        ],
    }

def e2e_tests_step(suite, port = 3001, tries = None):
    cmd = "./bin/build e2e-tests --port {} --suite {}".format(port, suite)
    if tries:
        cmd += " --tries {}".format(tries)
    return {
        "name": "end-to-end-tests-{}".format(suite),
        "image": "cypress/included:9.5.1-node16.14.0-slim-chrome99-ff97",
        "depends_on": [
            "grafana-server",
        ],
        "environment": {
            "HOST": "grafana-server",
        },
        "commands": [
            "apt-get install -y netcat",
            cmd,
        ],
    }

def cloud_plugins_e2e_tests_step(suite, cloud, trigger = None):
    """Run cloud plugins end-to-end tests.

    Args:
      suite: affects the pipeline name.
        TODO: check if this actually affects step behavior.
      cloud: used to determine cloud provider specific tests.
      trigger: a Drone trigger for the step.
        Defaults to None.

    Returns:
      Drone step.
    """
    environment = {}
    when = {}
    if trigger:
        when = trigger
    if cloud == "azure":
        environment = {
            "CYPRESS_CI": "true",
            "HOST": "grafana-server",
            "GITHUB_TOKEN": from_secret("github_token_pr"),
            "AZURE_SP_APP_ID": from_secret("azure_sp_app_id"),
            "AZURE_SP_PASSWORD": from_secret("azure_sp_app_pw"),
            "AZURE_TENANT": from_secret("azure_tenant"),
        }
        when = dict(
            when,
            paths = {
                "include": [
                    "pkg/tsdb/azuremonitor/**",
                    "public/app/plugins/datasource/azuremonitor/**",
                    "e2e/cloud-plugins-suite/azure-monitor.spec.ts",
                ],
            },
        )
    branch = "${DRONE_SOURCE_BRANCH}".replace("/", "-")
    step = {
        "name": "end-to-end-tests-{}-{}".format(suite, cloud),
        "image": "us-docker.pkg.dev/grafanalabs-dev/cloud-data-sources/e2e:latest",
        "depends_on": [
            "grafana-server",
        ],
        "environment": environment,
        "commands": ["cd /", "./cpp-e2e/scripts/ci-run.sh {} {}".format(cloud, branch)],
    }
    step = dict(step, when = when)
    return step

def build_docs_website_step():
    return {
        "name": "build-docs-website",
        # Use latest revision here, since we want to catch if it breaks
        "image": "grafana/docs-base:latest",
        "commands": [
            "mkdir -p /hugo/content/docs/grafana/latest",
            "cp -r docs/sources/* /hugo/content/docs/grafana/latest/",
            "cd /hugo && make prod",
        ],
    }

def copy_packages_for_docker_step(edition = None):
    return {
        "name": "copy-packages-for-docker",
        "image": build_image,
        "depends_on": [
            "package" + enterprise2_suffix(edition),
        ],
        "commands": [
            "ls dist/*.tar.gz*",
            "cp dist/*.tar.gz* packaging/docker/",
        ],
    }

def build_docker_images_step(edition, archs = None, ubuntu = False, publish = False):
    """Build Docker images using the Grafana build tool.

    Args:
      edition: controls which repository the image is published to.
      archs: a list of architectures to build the image for.
        Defaults to None.
      ubuntu: controls whether the final image is built from an Ubuntu base image.
        Defaults to False.
      publish: controls whether the built image is saved to a pre-release repository.
        Defaults to False.

    Returns:
      Drone step.
    """
    cmd = "./bin/build build-docker --edition {}".format(edition)
    if publish:
        cmd += " --shouldSave"

    ubuntu_sfx = ""
    if ubuntu:
        ubuntu_sfx = "-ubuntu"
        cmd += " --ubuntu"

    if archs:
        cmd += " -archs {}".format(",".join(archs))

    environment = {
        "GCP_KEY": from_secret("gcp_key"),
    }

    if edition == "enterprise2":
        environment.update(
            {"DOCKER_ENTERPRISE2_REPO": from_secret("docker_enterprise2_repo")},
        )

    return {
        "name": "build-docker-images" + ubuntu_sfx,
        "image": "google/cloud-sdk",
        "depends_on": [
            "copy-packages-for-docker",
            "compile-build-cmd",
        ],
        "commands": [cmd],
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
        "environment": environment,
    }

def fetch_images_step(edition):
    return {
        "name": "fetch-images-{}".format(edition),
        "image": "google/cloud-sdk",
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "DOCKER_USER": from_secret("docker_username"),
            "DOCKER_PASSWORD": from_secret("docker_password"),
            "DOCKER_ENTERPRISE2_REPO": from_secret("docker_enterprise2_repo"),
        },
        "commands": ["./bin/build artifacts docker fetch --edition {}".format(edition)],
        "depends_on": ["compile-build-cmd"],
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

def publish_images_step(edition, ver_mode, mode, docker_repo, trigger = None):
    """Generates a step for publishing public Docker images with grabpl.

    Args:
      edition: controls which version of an image is fetched in the case of a release.
        It also controls which publishing implementation is used.
      ver_mode: controls whether the image needs to be built or retrieved from a previous build.
        If ver_mode == 'release', the previously built image is fetched instead of being built again.
      mode: uses to control the publishing of security images when mode == 'security'.
      docker_repo: the Docker image name.
        It is combined with the 'grafana/' library prefix.
      trigger: a Drone trigger for the pipeline.
        Defaults to None.

    Returns:
      Drone step.
    """
    name = docker_repo
    docker_repo = "grafana/{}".format(docker_repo)
    if mode == "security":
        mode = "--{} ".format(mode)
    else:
        mode = ""

    environment = {
        "GCP_KEY": from_secret("gcp_key"),
        "DOCKER_USER": from_secret("docker_username"),
        "DOCKER_PASSWORD": from_secret("docker_password"),
    }

    cmd = "./bin/grabpl artifacts docker publish {}--dockerhub-repo {}".format(
        mode,
        docker_repo,
    )

    deps = ["build-docker-images", "build-docker-images-ubuntu"]
    if ver_mode == "release":
        deps = ["fetch-images-{}".format(edition)]
        cmd += " --version-tag ${DRONE_TAG}"

    if edition == "enterprise2":
        name = edition
        docker_repo = "$${DOCKER_ENTERPRISE2_REPO}"
        environment.update(
            {
                "GCP_KEY": from_secret("gcp_key_hg"),
                "DOCKER_ENTERPRISE2_REPO": from_secret("docker_enterprise2_repo"),
            },
        )
        cmd = "./bin/build artifacts docker publish-enterprise2 --dockerhub-repo {}".format(
            docker_repo,
        )

    step = {
        "name": "publish-images-{}".format(name),
        "image": "google/cloud-sdk",
        "environment": environment,
        "commands": [cmd],
        "depends_on": deps,
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }
    if trigger and ver_mode in ("release-branch", "main"):
        step = dict(step, when = trigger)

    return step

def postgres_integration_tests_step():
    cmds = [
        "apt-get update",
        "apt-get install -yq postgresql-client",
        "dockerize -wait tcp://postgres:5432 -timeout 120s",
        "psql -p 5432 -h postgres -U grafanatest -d grafanatest -f " +
        "devenv/docker/blocks/postgres_tests/setup.sql",
        # Make sure that we don't use cached results for another database
        "go clean -testcache",
        "go list './pkg/...' | xargs -I {} sh -c 'go test -run Integration -covermode=atomic -timeout=5m {}'",
    ]
    return {
        "name": "postgres-integration-tests",
        "image": build_image,
        "depends_on": ["wire-install"],
        "environment": {
            "PGPASSWORD": "grafanatest",
            "GRAFANA_TEST_DB": "postgres",
            "POSTGRES_HOST": "postgres",
        },
        "commands": cmds,
    }

def mysql_integration_tests_step():
    cmds = [
        "apt-get update",
        "apt-get install -yq default-mysql-client",
        "dockerize -wait tcp://mysql:3306 -timeout 120s",
        "cat devenv/docker/blocks/mysql_tests/setup.sql | mysql -h mysql -P 3306 -u root -prootpass",
        # Make sure that we don't use cached results for another database
        "go clean -testcache",
        "go list './pkg/...' | xargs -I {} sh -c 'go test -run Integration -covermode=atomic -timeout=5m {}'",
    ]
    return {
        "name": "mysql-integration-tests",
        "image": build_image,
        "depends_on": ["wire-install"],
        "environment": {
            "GRAFANA_TEST_DB": "mysql",
            "MYSQL_HOST": "mysql",
        },
        "commands": cmds,
    }

def redis_integration_tests_step():
    return {
        "name": "redis-integration-tests",
        "image": build_image,
        "depends_on": ["wire-install"],
        "environment": {
            "REDIS_URL": "redis://redis:6379/0",
        },
        "commands": [
            "dockerize -wait tcp://redis:6379/0 -timeout 120s",
            "go clean -testcache",
            "go test -run IntegrationRedis -covermode=atomic -timeout=2m ./pkg/...",
        ],
    }

def memcached_integration_tests_step():
    return {
        "name": "memcached-integration-tests",
        "image": build_image,
        "depends_on": ["wire-install"],
        "environment": {
            "MEMCACHED_HOSTS": "memcached:11211",
        },
        "commands": [
            "dockerize -wait tcp://memcached:11211 -timeout 120s",
            "go clean -testcache",
            "go test -run IntegrationMemcached -covermode=atomic -timeout=2m ./pkg/...",
        ],
    }

def release_canary_npm_packages_step(trigger = None):
    """Releases canary NPM packages.

    Args:
      trigger: a Drone trigger for the step.
        Defaults to None.

    Returns:
      Drone step.
    """
    step = {
        "name": "release-canary-npm-packages",
        "image": build_image,
        "depends_on": end_to_end_tests_deps(),
        "environment": {
            "NPM_TOKEN": from_secret("npm_token"),
        },
        "commands": [
            "./scripts/circle-release-canary-packages.sh",
        ],
    }
    if trigger:
        step = dict(step, when = trigger)
    return step

def enterprise2_suffix(edition):
    if edition == "enterprise2":
        return "-{}".format(edition)
    return ""

def upload_packages_step(edition, ver_mode, trigger = None):
    """Upload packages to object storage.

    Args:
      edition: controls which edition of Grafana packages to upload.
      ver_mode: when ver_mode == 'main', inhibit upload of enterprise
        edition packages when executed.
      trigger: a Drone trigger for the step.
        Defaults to None.

    Returns:
      Drone step.
    """
    step = {
        "name": "upload-packages" + enterprise2_suffix(edition),
        "image": publish_image,
        "depends_on": end_to_end_tests_deps(),
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
            "PRERELEASE_BUCKET": from_secret("prerelease_bucket"),
        },
        "commands": [
            "./bin/build upload-packages --edition {}".format(edition),
        ],
    }
    if trigger and ver_mode in ("release-branch", "main"):
        step = dict(step, when = trigger)
    return step

def publish_grafanacom_step(edition, ver_mode):
    """Publishes Grafana packages to grafana.com.

    Args:
      edition: controls which edition of Grafana to publish to.
      ver_mode: if ver_mode == 'main', pass the DRONE_BUILD_NUMBER environment
        variable as the value for the --build-id option.
        TODO: is this actually used by the grafanacom subcommand? I think it might
        just use the environment varaiable directly.

    Returns:
      Drone step.
    """
    if ver_mode == "release":
        cmd = "./bin/build publish grafana-com --edition {} ${{DRONE_TAG}}".format(
            edition,
        )
    elif ver_mode == "main":
        build_no = "${DRONE_BUILD_NUMBER}"
        cmd = "./bin/build publish grafana-com --edition {} --build-id {}".format(
            edition,
            build_no,
        )
    else:
        fail("Unexpected version mode {}".format(ver_mode))

    return {
        "name": "publish-grafanacom-{}".format(edition),
        "image": publish_image,
        "depends_on": [
            "publish-linux-packages-deb",
            "publish-linux-packages-rpm",
        ],
        "environment": {
            "GRAFANA_COM_API_KEY": from_secret("grafana_api_key"),
            "GCP_KEY": from_secret("gcp_key"),
        },
        "commands": [
            cmd,
        ],
    }

def publish_linux_packages_step(edition, package_manager = "deb"):
    return {
        "name": "publish-linux-packages-{}".format(package_manager),
        # See https://github.com/grafana/deployment_tools/blob/master/docker/package-publish/README.md for docs on that image
        "image": "us.gcr.io/kubernetes-dev/package-publish:latest",
        "depends_on": ["compile-build-cmd"],
        "privileged": True,
        "settings": {
            "access_key_id": from_secret("packages_access_key_id"),
            "secret_access_key": from_secret("packages_secret_access_key"),
            "service_account_json": from_secret("packages_service_account"),
            "target_bucket": "grafana-packages",
            "deb_distribution": "auto",
            "gpg_passphrase": from_secret("packages_gpg_passphrase"),
            "gpg_public_key": from_secret("packages_gpg_public_key"),
            "gpg_private_key": from_secret("packages_gpg_private_key"),
            "package_path": "gs://grafana-prerelease/artifacts/downloads/*${{DRONE_TAG}}/{}/**.{}".format(
                edition,
                package_manager,
            ),
        },
    }

def get_windows_steps(edition, ver_mode):
    """Generate the list of Windows steps.

    Args:
      edition: used to differentiate steps for different Grafana editions.
      ver_mode: used to differentiate steps for different version modes.

    Returns:
      List of Drone steps.
    """
    steps = [
        identify_runner_step("windows"),
    ]

    if edition in ("enterprise", "enterprise2"):
        if ver_mode == "release":
            source = "${DRONE_TAG}"
        elif ver_mode == "release-branch":
            source = "$$env:DRONE_BRANCH"
        else:
            source = "$$env:DRONE_COMMIT"

        # For enterprise, we have to clone both OSS and enterprise and merge the latter into the former
        download_grabpl_cmds = [
            '$$ProgressPreference = "SilentlyContinue"',
            "Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe".format(
                grabpl_version,
            ),
        ]

        clone_cmds = [
            'git clone "https://$$env:GITHUB_TOKEN@github.com/grafana/grafana-enterprise.git"',
            "cd grafana-enterprise",
            "git checkout {}".format(source),
        ]

        init_cmds = [
            # Need to move grafana-enterprise out of the way, so directory is empty and can be cloned into
            "cp -r grafana-enterprise C:\\App\\grafana-enterprise",
            "rm -r -force grafana-enterprise",
            "cp grabpl.exe C:\\App\\grabpl.exe",
            "rm -force grabpl.exe",
            "C:\\App\\grabpl.exe init-enterprise --github-token $$env:GITHUB_TOKEN C:\\App\\grafana-enterprise",
            "cp C:\\App\\grabpl.exe grabpl.exe",
        ]

        steps.extend(
            [
                {
                    "name": "clone",
                    "image": wix_image,
                    "environment": {
                        "GITHUB_TOKEN": from_secret("github_token"),
                    },
                    "commands": download_grabpl_cmds + clone_cmds,
                },
                {
                    "name": "windows-init",
                    "image": wix_image,
                    "commands": init_cmds,
                    "depends_on": ["clone"],
                    "environment": {"GITHUB_TOKEN": from_secret("github_token")},
                },
            ],
        )
    else:
        init_cmds = [
            '$$ProgressPreference = "SilentlyContinue"',
            "Invoke-WebRequest https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/{}/windows/grabpl.exe -OutFile grabpl.exe".format(
                grabpl_version,
            ),
        ]

        steps.extend(
            [
                {
                    "name": "windows-init",
                    "image": wix_image,
                    "commands": init_cmds,
                },
            ],
        )

    if (
        ver_mode == "main" and (edition not in ("enterprise", "enterprise2"))
    ) or ver_mode in (
        "release",
        "release-branch",
    ):
        bucket = "%PRERELEASE_BUCKET%/artifacts/downloads"
        if ver_mode == "release":
            ver_part = "${DRONE_TAG}"
            dir = "release"
        else:
            dir = "main"
            bucket = "grafana-downloads"
            build_no = "DRONE_BUILD_NUMBER"
            ver_part = "--build-id $$env:{}".format(build_no)
        installer_commands = [
            "$$gcpKey = $$env:GCP_KEY",
            "[System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($$gcpKey)) > gcpkey.json",
            # gcloud fails to read the file unless converted with dos2unix
            "dos2unix gcpkey.json",
            "gcloud auth activate-service-account --key-file=gcpkey.json",
            "rm gcpkey.json",
            "cp C:\\App\\nssm-2.24.zip .",
        ]
        if (
            ver_mode == "main" and (edition not in ("enterprise", "enterprise2"))
        ) or ver_mode in ("release",):
            installer_commands.extend(
                [
                    ".\\grabpl.exe windows-installer --edition {} {}".format(
                        edition,
                        ver_part,
                    ),
                    '$$fname = ((Get-Childitem grafana*.msi -name) -split "`n")[0]',
                ],
            )
            if ver_mode == "main":
                installer_commands.extend(
                    [
                        "gsutil cp $$fname gs://{}/{}/{}/".format(bucket, edition, dir),
                        'gsutil cp "$$fname.sha256" gs://{}/{}/{}/'.format(
                            bucket,
                            edition,
                            dir,
                        ),
                    ],
                )
            else:
                installer_commands.extend(
                    [
                        "gsutil cp $$fname gs://{}/{}/{}/{}/".format(
                            bucket,
                            ver_part,
                            edition,
                            dir,
                        ),
                        'gsutil cp "$$fname.sha256" gs://{}/{}/{}/{}/'.format(
                            bucket,
                            ver_part,
                            edition,
                            dir,
                        ),
                    ],
                )
        steps.append(
            {
                "name": "build-windows-installer",
                "image": wix_image,
                "depends_on": [
                    "windows-init",
                ],
                "environment": {
                    "GCP_KEY": from_secret("gcp_key"),
                    "PRERELEASE_BUCKET": from_secret(prerelease_bucket),
                    "GITHUB_TOKEN": from_secret("github_token"),
                },
                "commands": installer_commands,
            },
        )

    return steps

def verify_gen_cue_step():
    return {
        "name": "verify-gen-cue",
        "image": build_image,
        "depends_on": [],
        "commands": [
            "# It is required that code generated from Thema/CUE be committed and in sync with its inputs.",
            "# The following command will fail if running code generators produces any diff in output.",
            "CODEGEN_VERIFY=1 make gen-cue",
        ],
    }

def verify_gen_jsonnet_step():
    return {
        "name": "verify-gen-jsonnet",
        "image": build_image,
        "depends_on": [],
        "commands": [
            "# It is required that generated jsonnet is committed and in sync with its inputs.",
            "# The following command will fail if running code generators produces any diff in output.",
            "CODEGEN_VERIFY=1 make gen-jsonnet",
        ],
    }

def trigger_test_release():
    return {
        "name": "trigger-test-release",
        "image": build_image,
        "environment": {
            "GITHUB_TOKEN": from_secret("github_token_pr"),
            "TEST_TAG": "v0.0.0-test",
        },
        "commands": [
            'git clone "https://$${GITHUB_TOKEN}@github.com/grafana/grafana-enterprise.git" --depth=1',
            "cd grafana-enterprise",
            'git fetch origin "refs/tags/*:refs/tags/*" --quiet',
            "if git show-ref --tags $${TEST_TAG} --quiet; then git tag -d $${TEST_TAG} && git push --delete origin $${TEST_TAG}; fi",
            "git tag $${TEST_TAG} && git push origin $${TEST_TAG}",
            "cd -",
            'git fetch https://$${GITHUB_TOKEN}@github.com/grafana/grafana.git "refs/tags/*:refs/tags/*" --quiet && git fetch --quiet',
            "if git show-ref --tags $${TEST_TAG} --quiet; then git tag -d $${TEST_TAG} && git push --delete https://$${GITHUB_TOKEN}@github.com/grafana/grafana.git $${TEST_TAG}; fi",
            "git tag $${TEST_TAG} && git push https://$${GITHUB_TOKEN}@github.com/grafana/grafana.git $${TEST_TAG}",
        ],
        "failure": "ignore",
        "when": {
            "paths": {
                "include": [
                    ".drone.yml",
                    "pkg/build/**",
                ],
            },
            "repo": [
                "grafana/grafana",
            ],
        },
    }

def artifacts_page_step():
    return {
        "name": "artifacts-page",
        "image": build_image,
        "depends_on": [
            "compile-build-cmd",
        ],
        "environment": {
            "GCP_KEY": from_secret("gcp_key"),
        },
        "commands": [
            "./bin/build artifacts-page",
        ],
    }

def end_to_end_tests_deps():
    return [
        "end-to-end-tests-dashboards-suite",
        "end-to-end-tests-panels-suite",
        "end-to-end-tests-smoke-tests-suite",
        "end-to-end-tests-various-suite",
    ]

def compile_build_cmd(edition = "oss"):
    dependencies = []
    if edition in ("enterprise", "enterprise2"):
        dependencies = [
            "init-enterprise",
        ]
    return {
        "name": "compile-build-cmd",
        "image": go_image,
        "commands": [
            "go build -o ./bin/build -ldflags '-extldflags -static' ./pkg/build/cmd",
        ],
        "depends_on": dependencies,
        "environment": {
            "CGO_ENABLED": 0,
        },
    }

def get_trigger_storybook(ver_mode):
    """Generate a Drone trigger for UI changes that affect the Grafana UI storybook.

    Args:
      ver_mode: affects whether the trigger is event tags or changed files.

    Returns:
      Drone trigger.
    """
    trigger_storybook = ""
    if ver_mode == "release":
        trigger_storybook = {"event": ["tag"]}
    else:
        trigger_storybook = {
            "paths": {
                "include": [
                    "packages/grafana-ui/**",
                ],
            },
        }
    return trigger_storybook
