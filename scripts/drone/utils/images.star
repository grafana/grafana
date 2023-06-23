"""
This module contains all the docker images that are used to build test and publish Grafana.
"""

images = {
    "cloudsdk_image": "google/cloud-sdk:431.0.0",
    "build_image": "grafana/build-container:1.7.4",
    "publish_image": "grafana/grafana-ci-deploy:1.3.3",
    "alpine_image": "alpine:3.17.1",
    "curl_image": "byrnedo/alpine-curl:0.1.8",
    "go_image": "golang:1.20.4",
    "plugins_slack_image": "plugins/slack",
    "postgres_alpine_image": "postgres:12.3-alpine",
    "mysql5_image": "mysql:5.7.39",
    "mysql8_image": "mysql:8.0.32",
    "redis_alpine_image": "redis:6.2.11-alpine",
    "memcached_alpine_image": "memcached:1.6.9-alpine",
    "package_publish_image": "us.gcr.io/kubernetes-dev/package-publish:latest",
    "openldap_image": "osixia/openldap:1.4.0",
    "drone_downstream_image": "grafana/drone-downstream",
    "docker_puppeteer_image": "grafana/docker-puppeteer:1.1.0",
    "docs_image": "grafana/docs-base:dbd975af06",
    "cypress_image": "cypress/included:9.5.1-node16.14.0-slim-chrome99-ff97",
    "cloud_datasources_e2e_image": "us-docker.pkg.dev/grafanalabs-dev/cloud-data-sources/e2e:latest",
}
