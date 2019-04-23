#!/bin/sh
set -e

_grafana_tag=${1:-}
_docker_repo=${2:-grafana/grafana}

# If the tag starts with v, treat this as a official release
if echo "$_grafana_tag" | grep -q "^v"; then
	_grafana_version=$(echo "${_grafana_tag}" | cut -d "v" -f 2)
else
	_grafana_version=$_grafana_tag
fi

export DOCKER_CLI_EXPERIMENTAL=enabled

echo "pushing ${_docker_repo}:${_grafana_version}"


docker_push_all () {
	repo=$1
	tag=$2

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
}

if echo "$_grafana_tag" | grep -q "^v" && echo "$_grafana_tag" | grep -vq "beta"; then
	echo "pushing ${_docker_repo}:latest"
	docker_push_all "${_docker_repo}" "latest"
	docker_push_all "${_docker_repo}" "${_grafana_version}"
elif echo "$_grafana_tag" | grep -q "^v" && echo "$_grafana_tag" | grep -q "beta"; then
	docker_push_all "${_docker_repo}" "${_grafana_version}"
elif echo "$_grafana_tag" | grep -q "master"; then
	docker_push_all "${_docker_repo}" "master"
	docker push "grafana/grafana-dev:${_grafana_version}"
fi
