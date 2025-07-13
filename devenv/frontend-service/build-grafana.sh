VERSION=$(jq -r .version package.json)

echo "Building Grafana with ${VERSION}"

echo "Go mod cache: $(go env GOMODCACHE), $(ls -1 $(go env GOMODCACHE) | wc -l) items"
echo "Go build cache: $(go env GOCACHE), $(ls -1 $(go env GOCACHE) | wc -l) items"

go build \
  -ldflags "-X main.version=${VERSION}" \
  -gcflags "all=-N -l" \
  -o ./bin/grafana ./pkg/cmd/grafana
