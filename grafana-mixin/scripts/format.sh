#!/bin/bash
set -eo pipefail

cd "$(dirname "$0")"/..

. scripts/common.sh

find . -name 'vendor' -prune -o -name '*.libsonnet' -print -o -name '*.jsonnet' -print | \
  xargs -n 1 -- ${JSONNET_FMT} -i
