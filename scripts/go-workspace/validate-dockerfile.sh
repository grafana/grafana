#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

REPO_ROOT=$(dirname "${BASH_SOURCE[0]}")/../..
go run scripts/go-workspace/main.go validate-dockerfile --path "${REPO_ROOT}/go.work" --dockerfile-path "${REPO_ROOT}/Dockerfile"