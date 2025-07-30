#!/bin/bash

cd ../../

echo "Go mod cache: $(go env GOMODCACHE), $(ls -1 $(go env GOMODCACHE) | wc -l) items"
echo "Go build cache: $(go env GOCACHE), $(ls -1 $(go env GOCACHE) | wc -l) items"

# Set cross-compilation env vars only on macOS (Darwin)
if [[ "$(uname)" == "Darwin" ]]; then
  echo "Setting up cross-compilation environment for macOS"
  export CGO_ENABLED=0
  export GOOS=linux
  export GOARCH=arm64
fi

if [[ -n "$USE_ZIG" ]]; then
  echo "Using Zig for cross-compilation"
  export CGO_ENABLED=1
  export CC="zig cc -target aarch64-linux"
  export CXX="zig c++ -target aarch64-linux"
fi

# Need to build version into the binary so plugin compatibility works correctly
VERSION=$(jq -r .version package.json)

go build -v \
  -ldflags "-X main.version=${VERSION}" \
  -gcflags "all=-N -l" \
  -o ./devenv/frontend-service/build/grafana ./pkg/cmd/grafana