#!/bin/sh
BUILD_FAST=0

while [ "$1" != "" ]; do
  case "$1" in
    "--fast")
      BUILD_FAST=1
      echo "Fast build enabled"
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

# If the tag starts with v, treat this as a official release
if echo "$_grafana_tag" | grep -q "^v"; then
	_grafana_version=$(echo "${_grafana_tag}" | cut -d "v" -f 2)
else
	_grafana_version=$_grafana_tag
fi

echo "Building ${_docker_repo}:${_grafana_version}"

export DOCKER_CLI_EXPERIMENTAL=enabled

# Build grafana image for a specific arch
docker_build () {
	base_image=$1
	grafana_tgz=$2
	tag=$3

  docker build \
		--build-arg BASE_IMAGE=${base_image} \
		--build-arg GRAFANA_TGZ=${grafana_tgz} \
		--tag "${tag}" \
		--no-cache=true .
}

docker_tag_linux_amd64 () {
	repo=$1
	tag=$2
	docker tag "${_docker_repo}:${_grafana_version}" "${repo}:${tag}"
}

# Tag docker images of all architectures
docker_tag_all () {
	repo=$1
	tag=$2
	docker_tag_linux_amd64 $1 $2
	if [ $BUILD_FAST = "0" ]; then
		docker tag "${_docker_repo}-arm32v7-linux:${_grafana_version}" "${repo}-arm32v7-linux:${tag}"
		docker tag "${_docker_repo}-arm64v8-linux:${_grafana_version}" "${repo}-arm64v8-linux:${tag}"
	fi
}

docker_build "ubuntu:latest" "grafana-latest.linux-x64.tar.gz" "${_docker_repo}:${_grafana_version}"
if [ $BUILD_FAST = "0" ]; then
	docker_build "arm32v7/ubuntu:latest" "grafana-latest.linux-armv7.tar.gz" "${_docker_repo}-arm32v7-linux:${_grafana_version}"
	docker_build "arm64v8/ubuntu:latest" "grafana-latest.linux-arm64.tar.gz" "${_docker_repo}-arm64v8-linux:${_grafana_version}"
fi
# Tag as 'latest' for official release; otherwise tag as grafana/grafana:master
if echo "$_grafana_tag" | grep -q "^v"; then
	docker_tag_all "${_docker_repo}" "latest"
else
	docker_tag_all "${_docker_repo}" "master"
	docker tag "${_docker_repo}:${_grafana_version}" "grafana/grafana-dev:${_grafana_version}"
fi
