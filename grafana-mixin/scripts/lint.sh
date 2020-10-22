#!/bin/bash
set -eo pipefail

cd "$(dirname "$0")"/..

. scripts/common.sh

find . -name 'vendor' -prune -o -name '*.libsonnet' -print -o -name '*.jsonnet' -print | \
  while read f; do \
    ${JSONNET_FMT} "$f" | diff -u "$f" -; \
  done

mixtool lint mixin.libsonnet
