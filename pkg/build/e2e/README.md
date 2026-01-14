## Build artifacts

Put the resulting tar in your `grafana` OSS path:
```sh
go -C grafana run ./pkg/build/cmd artifacts -a targz:enterprise:linux/amd64 --alpine-base=alpine:3.22 --tag-format='{{ .version }}-{{ .buildID }}-{{ .arch }}' --grafana-dir="${PWD}/grafana" --enterprise-dir="${PWD}/grafana-enterprise"
```

Also build the e2e test runner:
```sh
GOOS=linux GOARCH=amd64 CGO_ENABLED=0 go build -o ./e2e-runner ./e2e/
```

And then `chmod +x ./e2e-runner`.

## Running tests

Reporting tests with Image Renderer:
```sh
go run ./pkg/build/e2e --suite=e2e/extensions/enterprise/smtp-suite --license=e2e/extensions/enterprise/license.jwt --image-renderer
```
