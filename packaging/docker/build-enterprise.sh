#!/bin/sh
set -e

_raw_grafana_tag=$1
_docker_repo=${2:-grafana/grafana-enterprise}

if echo "$_raw_grafana_tag" | grep -q "^v"; then
  _grafana_tag=$(echo "${_raw_grafana_tag}" | cut -d "v" -f 2)
else
  _grafana_tag="${_raw_grafana_tag}"
fi

echo "Building and deploying ${_docker_repo}:${_grafana_tag}"

docker build \
  --tag "${_docker_repo}:${_grafana_tag}"\
  --no-cache=true \
  .

docker push "${_docker_repo}:${_grafana_tag}"

if echo "$_raw_grafana_tag" | grep -q "^v" && echo "$_raw_grafana_tag" | grep -qv "beta"; then
  docker tag "${_docker_repo}:${_grafana_tag}" "${_docker_repo}:latest"
  docker push "${_docker_repo}:latest"
fi
