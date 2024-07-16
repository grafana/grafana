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
    "scripts/drone/utils/images.star",
    "images",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
)
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)


def publish_image_public_step():
    """Returns a step which publishes images

    Returns:
      A drone step which publishes Docker images for a public release.
    """
    commands = [
        "echo=",
        "if [[ -z ${DRY_RUN} ]];  then echo=echo; fi",
        "docker login -u ${DOCKER_USER} -p ${DOCKER_PASSWORD}",

        # Push the grafana-image-tags images
        "$echo docker push grafana/grafana-image-tags:${TAG}-amd64",
        "$echo docker push grafana/grafana-image-tags:${TAG}-arm64",
        "$echo docker push grafana/grafana-image-tags:${TAG}-armv7",
        "$echo docker push grafana/grafana-image-tags:${TAG}-ubuntu-amd64",
        "$echo docker push grafana/grafana-image-tags:${TAG}-ubuntu-arm64",
        "$echo docker push grafana/grafana-image-tags:${TAG}-ubuntu-armv7",

        # Create the grafana manifests
        "$echo docker manifest create grafana/grafana:${TAG} " +
        "grafana/grafana-image-tags:${TAG}-amd64 " +
        "grafana/grafana-image-tags:${TAG}-arm64 " +
        "grafana/grafana-image-tags:${TAG}-armv7",

        "$echo docker manifest create grafana/grafana:${TAG}-ubuntu " +
        "grafana/grafana-image-tags:${TAG}-ubuntu-amd64 " +
        "grafana/grafana-image-tags:${TAG}-ubuntu-arm64 " +
        "grafana/grafana-image-tags:${TAG}-ubuntu-armv7",

        # Push the grafana manifests
        "$echo docker manifest push grafana/grafana:${TAG}",
        "$echo docker manifest push grafana/grafana:${TAG}-ubuntu",

        # if LATEST is set, then also create & push latest
        "if [[ -z ${LATEST} ]]; then " +
            "$echo docker manifest create grafana/grafana:${TAG} " +
            "grafana/grafana-image-tags:${TAG}-amd64 " +
            "grafana/grafana-image-tags:${TAG}-arm64 " +
            "grafana/grafana-image-tags:${TAG}-armv7; " +
            "$echo docker manifest create grafana/grafana:${TAG}-ubuntu " +
            "grafana/grafana-image-tags:${TAG}-ubuntu-amd64 " +
            "grafana/grafana-image-tags:${TAG}-ubuntu-arm64 " +
            "grafana/grafana-image-tags:${TAG}-ubuntu-armv7;" +
        "fi",
    ]
    return {
        "environment": {
          "DOCKER_USER": from_secret("docker_username"),
          "DOCKER_PASSWORD": from_secret("docker_password"),
        },
        "name": "publish-images-grafana",
        "image": images["docker"],
        "depends_on": ["fetch-images"],
        "commands": commands,
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

def publish_image_steps():
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
        publish_image_public_step(),
        publish_images_step("release", "grafana-oss"),
    ]

    return steps

def publish_image_pipelines_public():
    """Generates the pipeline used for publising public Docker images.

    Returns:
      Drone pipeline
    """
    trigger = {
        "event": ["promote"],
        "target": ["public"],
    }
    return [
        pipeline(
            name = "publish-docker-public",
            trigger = trigger,
            steps = publish_image_steps(),
            environment = {"EDITION": "oss"},
        ),
    ]
