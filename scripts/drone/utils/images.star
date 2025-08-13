"""
This module contains all the docker images that are used to build test and publish Grafana.
"""

load(
    "scripts/drone/variables.star",
    "golang_version",
    "nodejs_version",
)

images = {
    "docker": "docker:27-cli",
    "git": "alpine/git:2.40.1",
    "go": "golang:{}-alpine".format(golang_version),
    "node": "node:{}-alpine".format(nodejs_version),
    "node_deb": "node:{}-bookworm".format(nodejs_version[:2]),
    "cloudsdk": "google/cloud-sdk:431.0.0",
    "publish": "grafana/grafana-ci-deploy:1.3.3",
    "alpine": "alpine:3.21.3",
    "ubuntu": "ubuntu:22.04",
    "curl": "byrnedo/alpine-curl:0.1.8",
    "plugins_slack": "plugins/slack",
    "package_publish": "us.gcr.io/kubernetes-dev/package-publish:latest",
    "drone_downstream": "grafana/drone-downstream",
    "docker_puppeteer": "grafana/docker-puppeteer:1.1.0",
    "docs": "grafana/docs-base:latest",
    "cypress": "cypress/included:14.3.2",
    "dockerize": "jwilder/dockerize:0.6.1",
    "github_app_secret_writer": "us-docker.pkg.dev/grafanalabs-global/docker-deployment-tools-prod/github-app-secret-writer:2024-11-05-v11688112090.1-83920c59",
}
