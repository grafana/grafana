#!/bin/bash
set -eo pipefail

_version="1.4.0"
_tag="grafana/grafana-ci-deploy:${_version}"

docker build -t $_tag .
docker push $_tag
