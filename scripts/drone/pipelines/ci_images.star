"""
This module contains steps and pipelines relating to creating CI Docker images.
"""

load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)
load(
    "scripts/drone/vault.star",
    "from_secret",
)
load(
    "scripts/drone/utils/windows_images.star",
    "windows_images",
)

def publish_ci_windows_test_image_pipeline():
    trigger = {
        "event": ["promote"],
        "target": ["ci-windows-test-image"],
    }
    pl = pipeline(
        name = "publish-ci-windows-test-image",
        trigger = trigger,
        edition = "",
        platform = "windows",
        steps = [
            {
                "name": "clone",
                "image": windows_images["wix_image"],
                "environment": {
                    "GITHUB_TOKEN": from_secret("github_token"),
                },
                "commands": [
                    'git clone "https://$$env:GITHUB_TOKEN@github.com/grafana/grafana-ci-sandbox.git" .',
                    "git checkout -f $$env:DRONE_COMMIT",
                ],
            },
            {
                "name": "build-and-publish",
                "image": windows_images["windows_server_core_image"],
                "environment": {
                    "DOCKER_USERNAME": from_secret("docker_username"),
                    "DOCKER_PASSWORD": from_secret("docker_password"),
                },
                "commands": [
                    "cd scripts\\build\\ci-windows-test",
                    "docker login -u $$env:DOCKER_USERNAME -p $$env:DOCKER_PASSWORD",
                    "docker build -t grafana/grafana-ci-windows-test:$$env:TAG .",
                    "docker push grafana/grafana-ci-windows-test:$$env:TAG",
                ],
                "volumes": [
                    {
                        "name": "docker",
                        "path": "//./pipe/docker_engine/",
                    },
                ],
            },
        ],
    )

    pl["clone"] = {
        "disable": True,
    }

    return [pl]
