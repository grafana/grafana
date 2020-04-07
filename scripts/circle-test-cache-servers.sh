#!/bin/bash

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/helpers/exit-if-fail.sh"

echo "running redis and memcache tests"

time exit_if_fail go test -tags=redis ./pkg/infra/remotecache/...
time exit_if_fail go test -tags=memcached ./pkg/infra/remotecache/...
