"""
This module contains all the docker images that are used to build test and publish Grafana.
"""

load(
    "scripts/drone/variables.star",
    "golang_version",
    "nodejs_version",
)

images = {
    "git": "alpine/git:2.40.1",
    "go": "golang:{}-alpine".format(golang_version),
    "node": "node:{}-alpine".format(nodejs_version),
    "cloudsdk": "google/cloud-sdk:431.0.0",
    "publish": "grafana/grafana-ci-deploy:1.3.3",
    "alpine": "alpine:3.18.5",
    "ubuntu": "ubuntu:22.04",
    "curl": "byrnedo/alpine-curl:0.1.8",
    "plugins_slack": "plugins/slack",
    "python": "python:3.8",
    "postgres_alpine": "postgres:12.3-alpine",
    "mimir": "grafana/mimir:r274-1780c50",
    "mysql5": "mysql:5.7.39",
    "mysql8": "mysql:8.0.32",
    "redis_alpine": "redis:6.2.11-alpine",
    "memcached_alpine": "memcached:1.6.9-alpine",
    "package_publish": "us.gcr.io/kubernetes-dev/package-publish:latest",
    "openldap": "osixia/openldap:1.4.0",
    "drone_downstream": "grafana/drone-downstream",
    "docker_puppeteer": "grafana/docker-puppeteer:1.1.0",
    "docs": "grafana/docs-base:latest",
    "cypress": "cypress/included:13.1.0",
    "dockerize": "jwilder/dockerize:0.6.1",
    "shellcheck": "koalaman/shellcheck:stable",
    "playwright": "mcr.microsoft.com/playwright:v1.41.2-jammy",
}
