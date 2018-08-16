#!/bin/sh
set -e

_grafana_tag=$1

# If the tag starts with v, treat this as a official release
if echo "$_grafana_tag" | grep -q "^v"; then
	_grafana_version=$(echo "${_grafana_tag}" | cut -d "v" -f 2)
	_docker_repo=${2:-grafana/grafana}
else
	_grafana_version=$_grafana_tag
	_docker_repo=${2:-grafana/grafana-dev}
fi

echo "pushing ${_docker_repo}:${_grafana_version}"
docker push "${_docker_repo}:${_grafana_version}"

if echo "$_grafana_tag" | grep -q "^v" && echo "$_grafana_tag" | grep -vq "beta"; then
	echo "pushing ${_docker_repo}:latest"
	docker push "${_docker_repo}:latest"
elif echo "$_grafana_tag" | grep -q "master"; then
	echo "pushing grafana/grafana:master"
	docker push grafana/grafana:master
fi
