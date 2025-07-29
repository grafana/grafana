#!/bin/bash

cd ../../

if [[ -n "$USE_DOCKER_BUILDER" ]]; then
  echo "Using Docker builder for Grafana build"

  docker run --rm --name grafana-go-builder \
  -v $(pwd):/src \
  -e HOST_UID=$(id -u) \
  -e HOST_GID=$(id -g) \
  -v go-cache:/go-cache \
  -v go-mod-cache:/go-mod-cache \
  --entrypoint /bin/sh \
  grafana-fs-builder \
  -c "cd /src/devenv/frontend-service; ./build-grafana.sh"
  exit $?
fi

echo "Go mod cache: $(go env GOMODCACHE), $(ls -1 $(go env GOMODCACHE) | wc -l) items"
echo "Go build cache: $(go env GOCACHE), $(ls -1 $(go env GOCACHE) | wc -l) items"

# Need to build version into the binary so plugin compatibility works correctly
VERSION=$(jq -r .version package.json)

# Set cross-compilation env vars only on macOS (Darwin)
if [[ "$(uname)" == "Darwin" ]]; then
  echo "Setting up cross-compilation environment for macOS"
  export CGO_ENABLED=1
  export GOOS=linux
  export GOARCH=arm64
  export CC="zig cc -target aarch64-linux"
  export CXX="zig c++ -target aarch64-linux"
fi

go build -v \
  -ldflags "-X main.version=${VERSION}" \
  -gcflags "all=-N -l" \
  -o ./devenv/frontend-service/build/grafana ./pkg/cmd/grafana

if [[ -n "$HOST_UID" && -n "$HOST_GID" ]]; then
  echo "Setting ownership of grafana binary to $HOST_UID:$HOST_GID"
  chown "$HOST_UID:$HOST_GID" ./devenv/frontend-service/build/grafana
fi
