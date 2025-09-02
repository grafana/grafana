#!/usr/bin/env bash

set -o errexit
set -o nounset
set -o pipefail

REPO_ROOT=$(dirname "${BASH_SOURCE[0]}")/../..

pushd "${REPO_ROOT}"
echo "running go work sync"
go work sync
popd

for mod in $(GOWORK=off go run scripts/go-workspace/main.go list-submodules --path "${REPO_ROOT}/go.work"); do
  pushd "${mod}"
  echo "Running go mod tidy in ${mod}"
  go mod tidy || true
  popd
done

pushd "${REPO_ROOT}"
echo "running go mod download"
go mod download
popd

