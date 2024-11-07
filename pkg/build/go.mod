module github.com/grafana/grafana/pkg/build

go 1.22.7

// Override docker/docker to avoid:
// go: github.com/drone-runners/drone-runner-docker@v1.8.2 requires
// github.com/docker/docker@v0.0.0-00010101000000-000000000000: invalid version: unknown revision 000000000000
replace github.com/docker/docker => github.com/moby/moby v23.0.4+incompatible

require (
	cloud.google.com/go/storage v1.38.0 // @grafana/grafana-backend-group
	github.com/Masterminds/semver/v3 v3.2.0 // @grafana/grafana-release-guild
	github.com/aws/aws-sdk-go v1.51.31 // @grafana/aws-datasources
	github.com/blang/semver/v4 v4.0.0 // @grafana/grafana-release-guild
	github.com/docker/docker v26.0.1+incompatible // @grafana/grafana-release-guild
	github.com/drone/drone-cli v1.6.1 // @grafana/grafana-release-guild
	github.com/gogo/protobuf v1.3.2 // indirect; @grafana/alerting-backend
	github.com/golang/protobuf v1.5.4 // indirect; @grafana/grafana-backend-group
	github.com/google/go-cmp v0.6.0 // @grafana/grafana-backend-group
	github.com/google/go-github v17.0.0+incompatible // @grafana/grafana-release-guild
	github.com/google/go-github/v45 v45.2.0 // @grafana/grafana-release-guild
	github.com/google/uuid v1.6.0 // indirect; @grafana/grafana-backend-group
	github.com/googleapis/gax-go/v2 v2.12.3 // indirect; @grafana/grafana-backend-group
	github.com/jmespath/go-jmespath v0.4.0 // indirect; @grafana/grafana-backend-group
	github.com/stretchr/testify v1.9.0 // @grafana/grafana-backend-group
	github.com/urfave/cli v1.22.15 // @grafana/grafana-backend-group
	github.com/urfave/cli/v2 v2.27.1 // @grafana/grafana-backend-group
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.51.0 // indirect; @grafana/plugins-platform-backend
	go.opentelemetry.io/otel v1.27.0 // indirect; @grafana/grafana-backend-group
	go.opentelemetry.io/otel/sdk v1.27.0 // indirect; @grafana/grafana-backend-group
	go.opentelemetry.io/otel/trace v1.27.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/crypto v0.24.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/mod v0.18.0 // @grafana/grafana-backend-group
	golang.org/x/net v0.26.0 // indirect; @grafana/oss-big-tent @grafana/partner-datasources
	golang.org/x/oauth2 v0.20.0 // @grafana/identity-access-team
	golang.org/x/sync v0.7.0 // indirect; @grafana/alerting-backend
	golang.org/x/text v0.16.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/time v0.5.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/tools v0.22.0 // indirect; @grafana/grafana-as-code
	google.golang.org/api v0.176.0 // @grafana/grafana-backend-group
	google.golang.org/grpc v1.64.0 // indirect; @grafana/plugins-platform-backend
	google.golang.org/protobuf v1.34.1 // indirect; @grafana/plugins-platform-backend
	gopkg.in/yaml.v3 v3.0.1 // @grafana/alerting-backend
)

require (
	cloud.google.com/go v0.112.1 // indirect
	cloud.google.com/go/auth v0.2.2 // indirect
	cloud.google.com/go/auth/oauth2adapt v0.2.1 // indirect
	cloud.google.com/go/compute/metadata v0.3.0 // indirect
	cloud.google.com/go/iam v1.1.6 // indirect
	github.com/Microsoft/go-winio v0.6.1 // indirect
	github.com/bmatcuk/doublestar v1.1.1 // indirect
	github.com/buildkite/yaml v2.1.0+incompatible // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.4 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/docker/distribution v2.8.2+incompatible // indirect
	github.com/docker/go-connections v0.4.0 // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/drone-runners/drone-runner-docker v1.8.2 // indirect
	github.com/drone/drone-go v1.7.1 // indirect
	github.com/drone/envsubst v1.0.3 // indirect
	github.com/drone/runner-go v1.12.0 // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/ghodss/yaml v1.0.1-0.20190212211648-25d852aebe32 // indirect
	github.com/go-logr/logr v1.4.1 // indirect; @grafana/grafana-app-platform-squad
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/google/go-querystring v1.1.0 // indirect
	github.com/google/s2a-go v0.1.7 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.2 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.3-0.20220512140940-7b36cea86235 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/xrash/smetrics v0.0.0-20201216005158-039620a65673 // indirect
	go.opencensus.io v0.24.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.51.0 // indirect
	go.opentelemetry.io/otel/metric v1.27.0 // indirect
	go.starlark.net v0.0.0-20230525235612-a134d8f9ddca // indirect
	golang.org/x/sys v0.21.0 // indirect
	google.golang.org/genproto v0.0.0-20240227224415-6ceb2ff114de // indirect; @grafana/grafana-backend-group
	google.golang.org/genproto/googleapis/api v0.0.0-20240604185151-ef581f913117 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240604185151-ef581f913117 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
)

require dagger.io/dagger v0.11.8

require (
	github.com/99designs/gqlgen v0.17.44 // indirect
	github.com/Khan/genqlient v0.7.0 // indirect
	github.com/adrg/xdg v0.4.0 // indirect
	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.20.0 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/moby/term v0.0.0-20221205130635-1aeaba878587 // indirect
	github.com/sosodev/duration v1.2.0 // indirect
	github.com/vektah/gqlparser/v2 v2.5.16 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.0.0-20240518090000-14441aefdf88 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.3.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.27.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.27.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.27.0 // indirect
	go.opentelemetry.io/otel/log v0.3.0 // indirect
	go.opentelemetry.io/otel/sdk/log v0.3.0 // indirect
	go.opentelemetry.io/proto/otlp v1.3.1 // indirect
	golang.org/x/exp v0.0.0-20240416160154-fe59bbe5cc7f // indirect
	gotest.tools/v3 v3.5.1 // indirect
)
