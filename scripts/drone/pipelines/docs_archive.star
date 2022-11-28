"""Build a docs archive and upload it to object storage for all maintained branches.

A branch is considered maintained if it is satisfies any of the following conditions:
  - is the 'main' branch
  - is a version branch (matching the regexp v[0-9]+\\.[0-9]+\\.x)
  - is a release branch (matching the regexp release-.+)

Returns:
  Drone pipeline.
"""

load(
    "scripts/drone/steps/lib.star",
    "alpine_image",
    "build_image",
    "google_sdk_image",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
    "pull_secret",
)

_archive_path = "./docs.tar.gz"
_object_path = "${DRONE_COMMIT}/docs.tar.gz"

_linux_platform = {
    "platform": {
        "os": "linux",
        "arch": "amd64",
    },
    "node": {
        "type": "no-parallel",
    },
}

_linux_pipeline = {
    "kind": "pipeline",
    "type": "docker",
    "platform": _linux_platform,
    "image_pull_secret": [pull_secret],
}

def _join(list, sep):
    """Join list elements with separator

    Args:
      list: list of strings to be joined.
      sep: string separator joined between each list element.

    Returns:
      string
    """
    if type(list) != "list":
        fail("the 'list' argument is expected to be of type 'list of string' but '{}' was provided".format(type(list)))

    if len(list) > 0 and type(list[0]) != "string":
        fail("the 'list' argument is expected to be of type 'list of string' but 'list of {}' was provided".format(type(list)))

    if type(sep) != "string":
        fail("the 'sep' argument is expected to be of type 'string' but '{}' was provided".format(type(list)))

    joined = ""
    for i, elem in enumerate(list):
        joined += elem
        if i != len(list):
            joined += sep
    return joined

docs_archive_pipeline = _linux_pipeline | {
    "name": "docs-archive",
    "steps": [
        {
            "name": "archive",
            "image": alpine_image,
            "commands": [
                "tar -czf {} -C docs/sources .".format(_archive_path),
            ],
        },
        {
            "name": "upload",
            "image": google_sdk_image,
            "commands": [
                "printenv SERVICE_ACCOUNT_KEY > /tmp/service_account_key.json",
                "gcloud auth activate-service-account --key-file=/tmp/service_account_key.json",
                "gsutil -m cp {} gs://grafana-prerelease/{}".format(_archive_path, _object_path),
            ],
            "environment": {
                "SERVICE_ACCOUNT_KEY": from_secret("gcp_key"),
            },
        },
    ],
    "trigger": {
        "branch": [
            "main",
            # TODO: what glob patterns are supported by Drone?
            "v[0-9]+.[0-9]+.[0-9]+",
            "release-*",
        ],
        "event": ["push"],
    },
}

docs_release_pipeline = _linux_pipeline | {
    "name": "docs-release",
    "clone": {"disable": True},
    "steps": [
        {
            "name": "await-upload",
            "image": alpine_image,
            "commands": [
                "TODO",
            ],
        },
        {
            "name": "download",
            "image": google_sdk_image,
            "commands": [
                "printenv SERVICE_ACCOUNT_KEY > /tmp/service_account_key.json",
                "gcloud auth activate-service-account --key-file=/tmp/service_account_key.json",
                "gsutil -m cp gs://grafana-prerelease/{} .".format(_object_path, _archive_path),
            ],
            "environment": {
                "SERVICE_ACCOUNT_KEY": from_secret("gcp_key"),
            },
        },
        {
            "name": "unarchive",
            "image": alpine_image,
            "commands": [
                "mkdir -p docs/sources",
                "tar -xzf {} -C docs/sources".format(_archive_path),
            ],
        },
        {
            "name": "publish",
            "image": build_image,
            "commands": [
                "curl -LO https://raw.githubusercontent.com/grafana/website-sync/master/entrypoint.sh?token=$${GITHUB_TOKEN}",
                _join([
                    "echo \"$${ENTRYPOINT_SHA256}  entrypoint.sh\" | sha256sum --check --strict --status \\",
                    "  || printf \"wanted: %s\\n   got: %s\\n\" \\",
                    "       $${ENTRYPOINT_SHA256} \\",
                    "       $(sha256sum entrypoint.sh | cut -d' ' -f1)",
                ], "\n"),
                _join([
                    "./entrypoint.sh \\",
                    "  grafana/website \\                                              # INPUT_REPOSITORY",
                    "  master \\                                                       # INPUT_BRANCH",
                    "  github.com \\                                                   # INPUT_GIT_HOST",
                    "  $${GITHUB_TOKEN}' \\                                            # INPUT_GITHUB_TOKEN",
                    "  '' \\                                                           # INPUT_GITHUB_PAT",
                    "  docs/sources \\                                                 # INPUT_SOURCE_FOLDER",
                    "  content/docs/grafana/$(./bin/build docs-target ${DRONE_TAG}) \\ # INPUT_TARGET_FOLDER",
                    "  ${DRONE_COMMIT_AUTHOR} \\                                       # INPUT_COMMIT_AUTHOR",
                    "  '' \\                                                           # INPUT_COMMIT_MESSAGE",
                    "  true \\                                                         # INPUT_DRYRUN",
                    "  '' \\                                                           # INPUT_WORKDIR",
                    "  true \\                                                         # INPUT_ALLOW_NO_CHANGES",
                ], "\n"),
            ],
            "environment": {
                "GITHUB_TOKEN": from_secret("github_token"),
                "ENTRYPOINT_SHA256": "2ddbb0d27ebe3859c1794008726b1b00d1fdea3491a8a59049d76654e9eebb3a",
            },
        },
    ],
    "trigger": {},  # TODO
}
