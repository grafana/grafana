#!/bin/bash

echo "Go mod cache: $(go env GOMODCACHE), $(ls -1 $(go env GOMODCACHE) | wc -l) items"
echo "Go build cache: $(go env GOCACHE), $(ls -1 $(go env GOCACHE) | wc -l) items"

# Need to build version into the binary so plugin compatibility works correctly
VERSION=$(jq -r .version package.json)

go build -v \
  -ldflags "-X main.version=${VERSION}" \
  -gcflags "all=-N -l" \
  -o ./bin/grafana ./pkg/cmd/grafana
