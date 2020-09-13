#!/bin/bash
set -eo pipefail

_version="1.2.26"
_tag="grafana/build-container:${_version}"

_dpath=$(dirname "${BASH_SOURCE[0]}")
cd "$_dpath"

if [[ -z "${OSX_SDK_URL}" ]]; then
  echo You must set OSX_SDK_URL
  exit 1
fi

docker build --build-arg OSX_SDK_URL="${OSX_SDK_URL}" -t $_tag .
docker push $_tag
