#!/bin/sh
set -e

_grafana_tag=$1
_docker_repo=${2:-grafana/grafana-enterprise}

docker build \
  --tag "${_docker_repo}:${_grafana_tag}"\
  --no-cache=true \
  .

docker push "${_docker_repo}:${_grafana_tag}"
