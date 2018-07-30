#!/bin/sh

_grafana_tag=$1

# If the tag starts with v, treat this as a official release
if echo "$_grafana_tag" | grep -q "^v"; then
	_grafana_version=$(echo "${_grafana_tag}" | cut -d "v" -f 2)
	_grafana_url="https://s3-us-west-2.amazonaws.com/grafana-releases/release/grafana-${_grafana_version}.linux-amd64.tar.gz"
	_docker_repo=${2:-grafana/grafana}
else
	_grafana_version=$_grafana_tag
	_grafana_url="https://s3-us-west-2.amazonaws.com/grafana-releases/master/grafana-${_grafana_version}.linux-x64.tar.gz"
	_docker_repo=${2:-grafana/grafana-dev}
fi

echo "Building ${_docker_repo}:${_grafana_version} from ${_grafana_url}"

docker build \
	--build-arg GRAFANA_URL="${_grafana_url}" \
	--tag "${_docker_repo}:${_grafana_version}" \
	--no-cache=true .

# Tag as 'latest' for official release; otherwise tag as grafana/grafana:master
if echo "$_grafana_tag" | grep -q "^v"; then
	docker tag "${_docker_repo}:${_grafana_version}" "${_docker_repo}:latest"
else
	docker tag "${_docker_repo}:${_grafana_version}" "grafana/grafana:master"
fi
