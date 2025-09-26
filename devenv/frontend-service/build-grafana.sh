#!/bin/bash

cd ../../

echo "Go mod cache: $(go env GOMODCACHE), $(ls -1 $(go env GOMODCACHE) | wc -l) items"
echo "Go build cache: $(go env GOCACHE), $(ls -1 $(go env GOCACHE) | wc -l) items"

# The docker container, even on macOS, is linux, so we need to cross-compile
# on macOS hosts to work on linux.
if [[ "$(uname)" == "Darwin" ]]; then
  echo "Setting up cross-compilation environment for macOS"
  export CGO_ENABLED=0
  export GOOS=linux
  export GOARCH=arm64
fi

# Need to build version into the binary so plugin compatibility works correctly
VERSION=$(jq -r .version package.json)

go build -v \
  -ldflags "-X main.version=${VERSION}" \
  -gcflags "all=-N -l" \
  -o ./devenv/frontend-service/build/grafana ./pkg/cmd/grafana
