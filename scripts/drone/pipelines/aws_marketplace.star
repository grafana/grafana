"""
This module contains steps and pipelines publishing to AWS Marketplace.
"""

load(
    "scripts/drone/steps/lib.star",
    "compile_build_cmd",
    "publish_image",
)
load("scripts/drone/vault.star", "from_secret")
load(
    "scripts/drone/utils/utils.star",
    "pipeline",
)

def publish_aws_marketplace_step():
    return {
        "name": "publish-aws-marketplace",
        "image": publish_image,
        "commands": ["./bin/build publish aws --image grafana/grafana-enterprise --repo grafana-labs/grafanaenterprise --product 422b46fb-bea6-4f27-8bcc-832117bd627e"],
        "depends_on": ["compile-build-cmd"],
        "environment": {
            "AWS_REGION": from_secret("aws_region"),
            "AWS_ACCESS_KEY_ID": from_secret("aws_access_key_id"),
            "AWS_SECRET_ACCESS_KEY": from_secret("aws_secret_access_key"),
        },
        "volumes": [{"name": "docker", "path": "/var/run/docker.sock"}],
    }

def publish_aws_marketplace_pipeline(mode):
    trigger = {
        "event": ["promote"],
        "target": [mode],
    }
    return [pipeline(
        name = "publish-aws-marketplace-{}".format(mode),
        trigger = trigger,
        steps = [compile_build_cmd(), publish_aws_marketplace_step()],
        edition = "",
        depends_on = ["publish-docker-enterprise-public"],
        environment = {"EDITION": "enterprise2"},
    )]
