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

_grafana_tag=${1:-}
_docker_repo=${2:-grafana/grafana}

# If the tag starts with v, treat this as an official release
if echo "$_grafana_tag" | grep -q "^v"; then
	_grafana_version=$(echo "${_grafana_tag}" | cut -d "v" -f 2)
else
	_grafana_version=$_grafana_tag
fi

export DOCKER_CLI_EXPERIMENTAL=enabled

if [ $UBUNTU_BASE = "0" ]; then
  echo "pushing ${_docker_repo}:${_grafana_version}"
else
  echo "pushing ${_docker_repo}:${_grafana_version}-ubuntu"
fi


docker_push_all () {
	repo=$1
	tag=$2

  if [ $UBUNTU_BASE = "0" ]; then
    # Push each image individually
    docker push "${repo}:${tag}"
    docker push "${repo}-arm32v7-linux:${tag}"
    docker push "${repo}-arm64v8-linux:${tag}"

    # Create and push a multi-arch manifest
    docker manifest create "${repo}:${tag}" \
      "${repo}:${tag}" \
      "${repo}-arm32v7-linux:${tag}" \
      "${repo}-arm64v8-linux:${tag}"

    docker manifest push "${repo}:${tag}"
  else
    docker push "${repo}:${tag}-ubuntu"
  fi
}

if echo "$_grafana_tag" | grep -q "^v" && echo "$_grafana_tag" | grep -vq "beta"; then
	echo "pushing ${_docker_repo}:latest"
	docker_push_all "${_docker_repo}" "latest"
	docker_push_all "${_docker_repo}" "${_grafana_version}"
	# Push to the grafana-dev repository with the expected tag
	# for running the end to end tests successfully
  if [ ${UBUNTU_BASE} = "0" ]; then
	  docker push "grafana/grafana-dev:${_grafana_tag}"
  else
	  docker push "grafana/grafana-dev:${_grafana_tag}-ubuntu"
  fi
elif echo "$_grafana_tag" | grep -q "^v" && echo "$_grafana_tag" | grep -q "beta"; then
	docker_push_all "${_docker_repo}" "${_grafana_version}"
	# Push to the grafana-dev repository with the expected tag
	# for running the end to end tests successfully
  if [ ${UBUNTU_BASE} = "0" ]; then
	  docker push "grafana/grafana-dev:${_grafana_tag}"
  else
	  docker push "grafana/grafana-dev:${_grafana_tag}-ubuntu"
  fi
elif echo "$_grafana_tag" | grep -q "master"; then
	docker_push_all "${_docker_repo}" "master"
  if [ ${UBUNTU_BASE} = "0" ]; then
    docker push "grafana/grafana-dev:${_grafana_version}"
  else
    docker push "grafana/grafana-dev:${_grafana_version}-ubuntu"
  fi
fi
