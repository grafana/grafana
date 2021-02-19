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
elif echo "$_raw_grafana_tag" | grep -q "^master-"; then
  _grafana_tag="master"
else
  _grafana_tag="${_raw_grafana_tag}"
fi

if [ ${UBUNTU_BASE} = "0" ]; then
  TAG_SUFFIX=""
  DOCKERFILE="Dockerfile"
else
  TAG_SUFFIX="-ubuntu"
  DOCKERFILE="ubuntu.Dockerfile"
fi

echo "Building and deploying ${_docker_repo}:${_grafana_tag}${TAG_SUFFIX}"

docker build \
  --tag "${_docker_repo}:${_grafana_tag}${TAG_SUFFIX}" \
  --no-cache=true \
  -f ${DOCKERFILE} \
  .

docker push "${_docker_repo}:${_grafana_tag}${TAG_SUFFIX}"

if echo "$_raw_grafana_tag" | grep -q "^v" && echo "$_raw_grafana_tag" | grep -qv "beta"; then
  docker tag "${_docker_repo}:${_grafana_tag}${TAG_SUFFIX}" "${_docker_repo}:latest${TAG_SUFFIX}"
  docker push "${_docker_repo}:latest${TAG_SUFFIX}"
fi


if echo "${_raw_grafana_tag}" | grep -q "^master-" && [ ${UBUNTU_BASE} = "1" ]; then
  docker tag "${_docker_repo}:${_grafana_tag}${TAG_SUFFIX}" "grafana/grafana-enterprise-dev:${_raw_grafana_tag}"
  docker push "grafana/grafana-enterprise-dev:${_raw_grafana_tag}"
fi

