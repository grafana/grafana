#!/bin/bash

mkdir -p dist

echo "Circle branch: ${CIRCLE_BRANCH}"
echo "Circle tag: ${CIRCLE_TAG}"
docker run -i -t --name gfbuild \
  -v $(pwd)/dist:/tmp/dist \
  -e "CIRCLE_BRANCH=${CIRCLE_BRANCH}" \
  -e "CIRCLE_TAG=${CIRCLE_BRANCH}" \
  grafana/buildcontainer
