#!/bin/sh
set -e

UBUNTU_BASE=0

while [ "$1" != "" ]; do
  case "$1" in
    "--ubuntu")
      UBUNTU_BASE=1
      echo "Ubuntu base image enabled"
      shift
      ;;
    * )
      # unknown param causes args to be passed through to $@
      break
      ;;
  esac
done

_raw_grafana_tag=$1
_docker_repo=${2:-grafana/grafana-enterprise}

if echo "$_raw_grafana_tag" | grep -q "^v"; then
  _grafana_tag=$(echo "${_raw_grafana_tag}" | cut -d "v" -f 2)
else
  _grafana_tag="${_raw_grafana_tag}"
fi

if [ ${UBUNTU_BASE} = "0" ]; then
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
else
  echo "Building and deploying ${_docker_repo}:${_grafana_tag}-ubuntu"

  docker build \
    --tag "${_docker_repo}:${_grafana_tag}-ubuntu"\
    --no-cache=true \
    -f Dockerfile.ubuntu \
    .

  docker push "${_docker_repo}:${_grafana_tag}-ubuntu"

  if echo "$_raw_grafana_tag" | grep -q "^v" && echo "$_raw_grafana_tag" | grep -qv "beta"; then
    docker tag "${_docker_repo}:${_grafana_tag}-ubuntu" "${_docker_repo}:latest-ubuntu"
    docker push "${_docker_repo}:latest-ubuntu"
  fi
fi
