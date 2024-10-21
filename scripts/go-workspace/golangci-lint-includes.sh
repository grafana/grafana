#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

REPO_ROOT=$(dirname "${BASH_SOURCE[0]}")/../..
INCLUDES=$(go run scripts/go-workspace/main.go list-submodules --path "${REPO_ROOT}/go.work" --delimiter '/... ' --skip golangci-lint)

# ./pkg/... is manually added to cover the root package without including scripts and devenv
printf './pkg/... %s' "${INCLUDES}"