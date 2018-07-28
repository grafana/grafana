#!/bin/sh

_grafana_tag=$1
_grafana_version=$(echo ${_grafana_tag} | cut -d "v" -f 2)
_docker_repo=${2:-grafana/grafana}


echo ${_grafana_version}

if [ "$_grafana_version" != "" ]; then
	echo "Building version ${_grafana_version}"
	docker build \
		--tag "${_docker_repo}:${_grafana_version}" \
		--no-cache=true .
	docker tag ${_docker_repo}:${_grafana_version} ${_docker_repo}:latest
else
	echo "Building latest for master"
	docker build \
		--tag "grafana/grafana:master" \
		.
fi
