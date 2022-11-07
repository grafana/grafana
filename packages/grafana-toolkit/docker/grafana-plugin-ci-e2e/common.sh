#!/bin/bash

##
## Common variable declarations
## Find the latest tag on https://hub.docker.com/r/grafana/grafana-plugin-ci-e2e/tags
##

DOCKER_IMAGE_BASE_NAME="grafana/grafana-plugin-ci-e2e"
DOCKER_IMAGE_VERSION="1.6.0"
DOCKER_IMAGE_NAME="${DOCKER_IMAGE_BASE_NAME}:${DOCKER_IMAGE_VERSION}"
