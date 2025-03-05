#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

DELIMITER="/...
"

REPO_ROOT=$(dirname "${BASH_SOURCE[0]}")/../..
go run scripts/go-workspace/main.go list-submodules --path "${REPO_ROOT}/go.work" --delimiter "${DELIMITER}"
