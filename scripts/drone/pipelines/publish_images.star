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

def publish_image_steps(docker_repo):
    """Generates the steps used for publising Docker images using grabpl.

    Args:
      docker_repo: the Docker image name.
        It is combined with the 'grafana/' library prefix.

    Returns:
      List of Drone steps.
    """
    steps = [
        identify_runner_step(),
        download_grabpl_step(),
        compile_build_cmd(),
        fetch_images_step(),
        publish_images_step("release", docker_repo),
        publish_images_step("release", "grafana-oss"),
    ]

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
            name = "publish-docker-{}".format(mode),
            trigger = trigger,
            steps = publish_image_steps(docker_repo = "grafana"),
            environment = {"EDITION": "oss"},
        ),
    ]
