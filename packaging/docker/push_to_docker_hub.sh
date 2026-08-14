#!/bin/sh
set -e

UBUNTU_BASE=0
TAG_SUFFIX=""

while [ "$1" != "" ]; do
  case "$1" in
    "--ubuntu")
      UBUNTU_BASE=1
      TAG_SUFFIX="-ubuntu"
      echo "Ubuntu base image enabled"
      shift
      ;;
    * )
      # unknown param causes args to be passed through to $@
      break
      ;;
  esac
done

_grafana_tag=${1:-}
_docker_repo=${2:-grafana/grafana}

# If the tag starts with v, treat this as an official release
if echo "$_grafana_tag" | grep -q "^v"; then
  _grafana_version=$(echo "${_grafana_tag}" | cut -d "v" -f 2)
else
  _grafana_version=$_grafana_tag
fi

echo "pushing ${_docker_repo}:${_grafana_version}${TAG_SUFFIX}"

export DOCKER_CLI_EXPERIMENTAL=enabled

docker_push_all () {
  repo=$1
  tag=$2

  # Push each image individually
  docker push "${repo}:${tag}${TAG_SUFFIX}"
  docker push "${repo}-arm32v7-linux:${tag}${TAG_SUFFIX}"
  docker push "${repo}-arm64v8-linux:${tag}${TAG_SUFFIX}"

  # Create and push a multi-arch manifest
  docker manifest create "${repo}:${tag}${TAG_SUFFIX}" \
    "${repo}:${tag}${TAG_SUFFIX}" \
    "${repo}-arm32v7-linux:${tag}${TAG_SUFFIX}" \
    "${repo}-arm64v8-linux:${tag}${TAG_SUFFIX}"

  docker manifest push "${repo}:${tag}${TAG_SUFFIX}"
}

if echo "$_grafana_tag" | grep -q "^v" && echo "$_grafana_tag" | grep -vq "beta"; then
  echo "pushing ${_docker_repo}:latest${TAG_SUFFIX}"
  docker_push_all "${_docker_repo}" "latest"
  docker_push_all "${_docker_repo}" "${_grafana_version}"
  # Push to the grafana-dev repository with the expected tag
  # for running the end to end tests successfully
  docker push "grafana/grafana-dev:${_grafana_tag}${TAG_SUFFIX}"
elif echo "$_grafana_tag" | grep -q "^v" && echo "$_grafana_tag" | grep -q "beta"; then
  docker_push_all "${_docker_repo}" "${_grafana_version}"
  # Push to the grafana-dev repository with the expected tag
  # for running the end to end tests successfully
  docker push "grafana/grafana-dev:${_grafana_tag}${TAG_SUFFIX}"
elif echo "$_grafana_tag" | grep -q "main"; then
  docker_push_all "${_docker_repo}" "main"
  docker push "grafana/grafana-dev:${_grafana_version}${TAG_SUFFIX}"
fi
