#!/bin/bash
set -eo pipefail

source ./common.sh

docker build -t ${DOCKER_IMAGE_NAME} .
docker push $DOCKER_IMAGE_NAME

