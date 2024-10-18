#!/bin/bash
set -eo pipefail

cd "$(dirname "$0")"/..

. scripts/common.sh
if [ -z "$JSONNET_FMT" ]; then
  echo "Error: JSONNET_FMT is not set. Please define the path to the jsonnet formatter."
  exit 1
fi

find . -name 'vendor' -prune -o -name '*.libsonnet' -print -o -name '*.jsonnet' -print | \
  xargs -n 1 --no-run-if-empty -- ${JSONNET_FMT} -i
