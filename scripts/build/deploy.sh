#!/bin/bash

mkdir -p dist

docker run -i -t --name gfbuild \
  -v $(pwd)/dist:/tmp/dist \
  -e "GRAFANA_BRANCH=${CIRCLE_BRANCH}" \
  grafana/buildcontainer
