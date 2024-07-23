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
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
)

def publish_image_public_step():
    """Returns a step which publishes images

    Returns:
      A drone step which publishes Docker images for a public release.
    """
    command = """
    debug=
    if [[ -n $${DRY_RUN} ]];  then debug=echo; fi
    docker login -u $${DOCKER_USER} -p $${DOCKER_PASSWORD}

    # Push the grafana-image-tags images
    $debug docker push grafana/grafana-image-tags:$${TAG}-amd64
    $debug docker push grafana/grafana-image-tags:$${TAG}-arm64
    $debug docker push grafana/grafana-image-tags:$${TAG}-armv7
    $debug docker push grafana/grafana-image-tags:$${TAG}-ubuntu-amd64
    $debug docker push grafana/grafana-image-tags:$${TAG}-ubuntu-arm64
    $debug docker push grafana/grafana-image-tags:$${TAG}-ubuntu-armv7

    # Create the grafana manifests
    $debug docker manifest create grafana/grafana:${TAG} \
      grafana/grafana-image-tags:$${TAG}-amd64 \
      grafana/grafana-image-tags:$${TAG}-arm64 \
      grafana/grafana-image-tags:$${TAG}-armv7

    $debug docker manifest create grafana/grafana:${TAG}-ubuntu \
      grafana/grafana-image-tags:$${TAG}-ubuntu-amd64 \
      grafana/grafana-image-tags:$${TAG}-ubuntu-arm64 \
      grafana/grafana-image-tags:$${TAG}-ubuntu-armv7

    # Push the grafana manifests
    $debug docker manifest push grafana/grafana:$${TAG}
    $debug docker manifest push grafana/grafana:$${TAG}-ubuntu

    # if LATEST is set, then also create & push latest
    if [[ -n $${LATEST} ]]; then
        $debug docker manifest create grafana/grafana:latest \
          grafana/grafana-image-tags:$${TAG}-amd64 \
          grafana/grafana-image-tags:$${TAG}-arm64 \
          grafana/grafana-image-tags:$${TAG}-armv7
        $debug docker manifest create grafana/grafana:latest-ubuntu \
          grafana/grafana-image-tags:$${TAG}-ubuntu-amd64 \
          grafana/grafana-image-tags:$${TAG}-ubuntu-arm64 \
          grafana/grafana-image-tags:$${TAG}-ubuntu-armv7

        $debug docker manifest push grafana/grafana:latest
        $debug docker manifest push grafana/grafana:latest-ubuntu

    fi
    """
    return {
        "environment": {
            "DOCKER_USER": from_secret("docker_username"),
            "DOCKER_PASSWORD": from_secret("docker_password"),
        },
        "name": "publish-images-grafana",
        "image": images["docker"],
        "depends_on": ["fetch-images"],
        "commands": [command],
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

def publish_image_pipelines_public():
    """Generates the pipeline used for publising public Docker images.

    Returns:
      Drone pipeline
    """
    return [
        pipeline(
            name = "publish-docker-public",
            trigger = {
                "event": ["promote"],
                "target": ["public"],
            },
            steps = [
                identify_runner_step(),
                download_grabpl_step(),
                compile_build_cmd(),
                fetch_images_step(),
                publish_image_public_step(),
                publish_images_step("release", "grafana-oss"),
            ],
            environment = {"EDITION": "oss"},
        ),
        pipeline(
            name = "manually-publish-docker-public",
            trigger = {
                "event": ["promote"],
                "target": ["publish-docker-public"],
            },
            steps = [
                identify_runner_step(),
                download_grabpl_step(),
                compile_build_cmd(),
                fetch_images_step(),
                publish_image_public_step(),
            ],
            environment = {"EDITION": "oss"},
        ),
    ]
