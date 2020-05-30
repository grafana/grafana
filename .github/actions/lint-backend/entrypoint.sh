#/bin/bash
set -xeo pipefail

pushd /tmp
curl -fLO https://github.com/golangci/golangci-lint/releases/download/v1.24.0/golangci-lint-1.24.0-linux-amd64.tar.gz
echo 241ca454102e909de04957ff8a5754c757cefa255758b3e1fba8a4533d19d179 \
  golangci-lint-1.24.0-linux-amd64.tar.gz | sha256sum --check --strict --status
tar -xf golangci-lint-1.24.0-linux-amd64.tar.gz
sudo mv golangci-lint-1.24.0-linux-amd64/golangci-lint /usr/local/bin/
popd
make scripts/go/bin/revive scripts/go/bin/gosec

go vet ./pkg/...
golangci-lint run -v -j 4 --config scripts/go/configs/ci/.golangci.yml -E deadcode -E gofmt \
  -E gosimple -E ineffassign -E structcheck -E typecheck ./pkg/...
golangci-lint run -v -j 4 --config scripts/go/configs/ci/.golangci.yml -E unconvert -E unused \
  -E varcheck -E goconst -E errcheck -E staticcheck ./pkg/...
./scripts/go/bin/revive -formatter stylish -config ./scripts/go/configs/revive.toml ./pkg/...
./scripts/go/bin/revive -formatter stylish -config ./scripts/go/configs/revive-strict.toml \
  ./pkg/services/alerting/... \
  ./pkg/services/provisioning/datasources/... \
  ./pkg/services/provisioning/dashboards/...
./scripts/go/bin/gosec -quiet -exclude=G104,G107,G108,G201,G202,G204,G301,G304,G401,G402,G501 \
  -conf=./scripts/go/configs/gosec.json ./pkg/...
