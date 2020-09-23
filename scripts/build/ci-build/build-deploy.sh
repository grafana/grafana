#!/bin/bash
set -eo pipefail

_version="1.2.27"
_tag="grafana/build-container:${_version}"

_dpath=$(dirname "${BASH_SOURCE[0]}")
cd "$_dpath"

docker build --build-arg OSX_SDK_URL="${OSX_SDK_URL}" -t $_tag .
docker push $_tag
