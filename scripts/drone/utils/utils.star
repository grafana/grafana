"""
This module contains utility functions for generating Drone pipelines.
"""

load(
    "scripts/drone/steps/lib.star",
    "slack_step",
)
load("scripts/drone/vault.star", "pull_secret")

failure_template = "Build {{build.number}} failed for commit: <https://github.com/{{repo.owner}}/{{repo.name}}/commit/{{build.commit}}|{{ truncate build.commit 8 }}>: {{build.link}}\nBranch: <https://github.com/{{ repo.owner }}/{{ repo.name }}/commits/{{ build.branch }}|{{ build.branch }}>\nAuthor: {{build.author}}"
drone_change_template = "`.drone.yml` and `starlark` files have been changed on the OSS repo, by: {{build.author}}. \nBranch: <https://github.com/{{ repo.owner }}/{{ repo.name }}/commits/{{ build.branch }}|{{ build.branch }}>\nCommit hash: <https://github.com/{{repo.owner}}/{{repo.name}}/commit/{{build.commit}}|{{ truncate build.commit 8 }}>"

def pipeline(
        name,
        edition,
        trigger,
        steps,
        services = [],
        platform = "linux",
        depends_on = [],
        environment = None,
        volumes = []):
    """Generate a Drone Docker pipeline with commonly used values.

    In addition to the parameters provided, it configures:
      - the use of an image pull secret
      - a retry count for cloning
      - a volume 'docker' that can be used to access the Docker socket

    Args:
      name: controls the pipeline name.
      edition: used to differentiate the pipeline for enterprise builds.
      trigger: a Drone trigger for the pipeline.
      steps: the Drone steps for the pipeline.
      services: auxilliary services used during the pipeline.
        Defaults to [].
      platform: abstracts platform specific configuration primarily for different Drone behavior on Windows.
        Defaults to 'linux'.
      depends_on: list of pipelines that must have succeeded before this pipeline can start.
        Defaults to [].
      environment: environment variables passed through to pipeline steps.
        Defaults to None.
      volumes: additional volumes available to be mounted by pipeline steps.
        Defaults to [].

    Returns:
      Drone pipeline
    """
    if platform != "windows":
        platform_conf = {
            "platform": {"os": "linux", "arch": "amd64"},
            # A shared cache is used on the host
            # To avoid issues with parallel builds, we run this repo on single build agents
            "node": {"type": "no-parallel"},
        }
    else:
        platform_conf = {
            "platform": {
                "os": "windows",
                "arch": "amd64",
                "version": "1809",
            },
        }

    docker_mount_path = "/var/run/docker.sock"
    if platform == "windows":
        docker_mount_path = "//./pipe/docker_engine/"

    pipeline = {
        "kind": "pipeline",
        "type": "docker",
        "name": name,
        "trigger": trigger,
        "services": services,
        "steps": steps,
        "clone": {
            "retries": 3,
        },
        "volumes": [
            {
                "name": "docker",
                "host": {
                    "path": docker_mount_path,
                },
            },
        ],
        "depends_on": depends_on,
        "image_pull_secrets": [pull_secret],
    }
    if environment:
        pipeline.update(
            {
                "environment": environment,
            },
        )

    pipeline["volumes"].extend(volumes)
    pipeline.update(platform_conf)

    if edition in ("enterprise", "enterprise2"):
        # We have a custom clone step for enterprise
        pipeline["clone"] = {
            "disable": True,
        }

    return pipeline

def notify_pipeline(
        name,
        slack_channel,
        trigger,
        depends_on = [],
        template = None,
        secret = None):
    trigger = dict(trigger)
    return {
        "kind": "pipeline",
        "type": "docker",
        "platform": {
            "os": "linux",
            "arch": "amd64",
        },
        "name": name,
        "trigger": trigger,
        "steps": [
            slack_step(slack_channel, template, secret),
        ],
        "clone": {
            "retries": 3,
        },
        "depends_on": depends_on,
    }

# TODO: this overrides any existing dependencies because we're following the existing logic
# it should append to any existing dependencies
def with_deps(steps, deps = []):
    for step in steps:
        step["depends_on"] = deps
    return steps
