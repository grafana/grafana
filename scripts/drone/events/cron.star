"""
This module provides functions for cronjob pipelines and steps used within.
"""

load("scripts/drone/vault.star", "from_secret")
load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
)
load(
    "scripts/drone/utils/images.star",
    "images",
)

aquasec_trivy_image = "aquasec/trivy:0.21.0"

def cronjobs():
    return [
        scan_docker_image_pipeline("latest"),
        scan_docker_image_pipeline("main"),
        scan_docker_image_pipeline("latest-ubuntu"),
        scan_docker_image_pipeline("main-ubuntu"),
        scan_build_test_publish_docker_image_pipeline(),
        grafana_com_nightly_pipeline(),
    ]

def cron_job_pipeline(cronName, name, steps):
    return {
        "kind": "pipeline",
        "type": "docker",
        "platform": {
            "os": "linux",
            "arch": "amd64",
        },
        "name": name,
        "trigger": {
            "event": "cron",
            "cron": cronName,
        },
        "clone": {
            "retries": 3,
        },
        "steps": steps,
    }

def scan_docker_image_pipeline(tag):
    """Generates a cronjob pipeline for nightly scans of grafana Docker images.

    Args:
      tag: determines which image tag is scanned.

    Returns:
      Drone cronjob pipeline.
    """
    docker_image = "grafana/grafana:{}".format(tag)

    return cron_job_pipeline(
        cronName = "nightly",
        name = "scan-" + docker_image + "-image",
        steps = [
            scan_docker_image_unknown_low_medium_vulnerabilities_step(docker_image),
            scan_docker_image_high_critical_vulnerabilities_step(docker_image),
            slack_job_failed_step("grafana-backend-ops", docker_image),
        ],
    )

def scan_build_test_publish_docker_image_pipeline():
    """Generates a cronjob pipeline for nightly scans of grafana Docker images.

    Returns:
      Drone cronjob pipeline.
    """

    return cron_job_pipeline(
        cronName = "nightly",
        name = "scan-build-test-and-publish-docker-images",
        steps = [
            scan_docker_image_unknown_low_medium_vulnerabilities_step("all"),
            scan_docker_image_high_critical_vulnerabilities_step("all"),
            slack_job_failed_step("grafana-backend-ops", "build-images"),
        ],
    )

def scan_docker_image_unknown_low_medium_vulnerabilities_step(docker_image):
    """Generates a step for scans of Grafana Docker images.

    Args:
      docker_image: determines which image is scanned.

    Returns:
      Drone cronjob step .
    """

    cmds = []
    if docker_image == "all":
        for key in images:
            cmds = cmds + ["trivy --exit-code 0 --severity UNKNOWN,LOW,MEDIUM " + images[key]]
    else:
        cmds = ["trivy --exit-code 0 --severity UNKNOWN,LOW,MEDIUM " + docker_image]
    return {
        "name": "scan-unknown-low-medium-vulnerabilities",
        "image": aquasec_trivy_image,
        "commands": cmds,
    }

def scan_docker_image_high_critical_vulnerabilities_step(docker_image):
    """Generates a step for scans of Grafana Docker images.

    Args:
      docker_image: determines which image is scanned.

    Returns:
      Drone cronjob step .
    """

    cmds = []
    if docker_image == "all":
        for key in images:
            cmds = cmds + ["trivy --exit-code 1 --severity HIGH,CRITICAL " + images[key]]
    else:
        cmds = ["trivy --exit-code 1 --severity HIGH,CRITICAL " + docker_image]
    return {
        "name": "scan-high-critical-vulnerabilities",
        "image": aquasec_trivy_image,
        "commands": cmds,
    }

def slack_job_failed_step(channel, image):
    return {
        "name": "slack-notify-failure",
        "image": images["plugins_slack_image"],
        "settings": {
            "webhook": from_secret("slack_webhook_backend"),
            "channel": channel,
            "template": "Nightly docker image scan job for " +
                        image +
                        " failed: {{build.link}}",
        },
        "when": {"status": "failure"},
    }

def post_to_grafana_com_step():
    return {
        "name": "post-to-grafana-com",
        "image": images["publish_image"],
        "environment": {
            "GRAFANA_COM_API_KEY": from_secret("grafana_api_key"),
            "GCP_KEY": from_secret("gcp_key"),
        },
        "depends_on": ["compile-build-cmd"],
        "commands": ["./bin/build publish grafana-com --edition oss"],
    }

def grafana_com_nightly_pipeline():
    return cron_job_pipeline(
        cronName = "grafana-com-nightly",
        name = "grafana-com-nightly",
        steps = [
            compile_build_cmd(),
            post_to_grafana_com_step(),
        ],
    )
