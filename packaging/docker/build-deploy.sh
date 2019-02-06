#!/bin/sh
set -e

_grafana_version=$1
./build.sh "$_grafana_version"
docker login -u "$DOCKER_USER" -p "$DOCKER_PASS"

./push_to_docker_hub.sh "$_grafana_version"

if echo "$_grafana_version" | grep -q "^master-"; then
  ./deploy_to_k8s.sh "grafana/grafana-dev:$_grafana_version"
fi
