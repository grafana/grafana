VERSION=$(jq -r .version package.json)

echo "Building Grafana with ${VERSION}"

echo "Go mod cache: $(go env GOMODCACHE)"
echo "Folders: $(ls -1 $(go env GOMODCACHE) | wc -l)"

echo "---"

echo "Go build cache: $(go env GOCACHE)"
echo "Folders: $(ls -1 $(go env GOCACHE) | wc -l)"

echo "---"

echo "Build dir: $(pwd)"
echo "Folders: $(ls -1 ./ | wc -l)"

echo "---"

go build \
  -ldflags "-X main.version=${VERSION}" \
  -gcflags "all=-N -l" \
  -o ./bin/grafana ./pkg/cmd/grafana

