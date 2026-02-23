#!/bin/bash

# Support running this file from tilt (where the cwd is devenv/frontend-service), or directly from the root
if [[ -f build-grafana.sh ]]; then
  cd ../../
fi

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

# Build enterprise if it is linked in
EXTRA_TAGS=""
if [[ -f pkg/extensions/ext.go ]]; then
  EXTRA_TAGS="-tags enterprise"
fi

# EXTRA_TAGS is intentionally unquoted to build the command
# shellcheck disable=SC2086
go build -v \
  -ldflags "-X main.version=${VERSION}" \
  -gcflags "all=-N -l" \
  ${EXTRA_TAGS} \
  -o ./devenv/frontend-service/build/grafana ./pkg/cmd/grafana
