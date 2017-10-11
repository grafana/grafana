#!/bin/bash

mkdir -p dist

echo "Circle branch: ${CIRCLE_BRANCH}"
echo "Circle tag: ${CIRCLE_TAG}"
docker run -i -t --name gfbuild \
  -v $(pwd):/go/src/github.com/grafana/grafana \
  -e "CIRCLE_BRANCH=${CIRCLE_BRANCH}" \
  -e "CIRCLE_TAG=${CIRCLE_TAG}" \
  -e "CIRCLE_BUILD_NUM=${CIRCLE_BUILD_NUM}" \
  grafana/buildcontainer

sudo chown -R ${USER:=$(/usr/bin/id -run)}:$USER dist
