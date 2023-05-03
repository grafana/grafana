"""
This module returns the pipeline used for publishing Docker images and its steps.
"""

load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "download_grabpl_step",
    "fetch_images_step",
    "identify_runner_step",
    "publish_images_step",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def publish_image_steps(edition, mode, docker_repo):
    """Generates the steps used for publising Docker images using grabpl.

    Args:
      edition: controls which version of an image is fetched in the case of a release.
        It also controls which publishing implementation is used.
        If edition == 'oss', it additionally publishes the grafana/grafana-oss repository.
      mode: uses to control the publishing of security images when mode == 'security'.
      docker_repo: the Docker image name.
        It is combined with the 'grafana/' library prefix.

    Returns:
      List of Drone steps.
    """
    steps = [
        identify_runner_step(),
        download_grabpl_step(),
        compile_build_cmd(),
        fetch_images_step(edition),
        publish_images_step(edition, "release", mode, docker_repo),
    ]

    if edition == "oss":
        steps.append(
            publish_images_step(edition, "release", mode, "grafana-oss"),
        )

    return steps

def publish_image_pipelines_public():
    """Generates the pipeline used for publising public Docker images.

    Returns:
      Drone pipeline
    """
    mode = "public"
    trigger = {
        "event": ["promote"],
        "target": [mode],
    }
    return [
        pipeline(
            name = "publish-docker-oss-{}".format(mode),
            trigger = trigger,
            steps = publish_image_steps(edition = "oss", mode = mode, docker_repo = "grafana"),
            edition = "",
            environment = {"EDITION": "oss"},
        ),
        pipeline(
            name = "publish-docker-enterprise-{}".format(mode),
            trigger = trigger,
            steps = publish_image_steps(
                edition = "enterprise",
                mode = mode,
                docker_repo = "grafana-enterprise",
            ),
            edition = "",
            environment = {"EDITION": "enterprise"},
        ),
    ]

def publish_image_pipelines_security():
    mode = "security"
    trigger = {
        "event": ["promote"],
        "target": [mode],
    }
    return [
        pipeline(
            name = "publish-docker-enterprise-{}".format(mode),
            trigger = trigger,
            steps = publish_image_steps(
                edition = "enterprise",
                mode = mode,
                docker_repo = "grafana-enterprise",
            ),
            edition = "",
            environment = {"EDITION": "enterprise"},
        ),
    ]
