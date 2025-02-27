module github.com/grafana/grafana/pkg/build

go 1.23.1

// Override docker/docker to avoid:
// go: github.com/drone-runners/drone-runner-docker@v1.8.2 requires
// github.com/docker/docker@v0.0.0-00010101000000-000000000000: invalid version: unknown revision 000000000000
replace github.com/docker/docker => github.com/moby/moby v26.0.0+incompatible

require (
	cloud.google.com/go/storage v1.43.0 // @grafana/grafana-backend-group
	github.com/Masterminds/semver/v3 v3.3.0 // @grafana/grafana-developer-enablement-squad
	github.com/aws/aws-sdk-go v1.55.5 // @grafana/aws-datasources
	github.com/docker/docker v27.4.1+incompatible // @grafana/grafana-developer-enablement-squad
	github.com/drone/drone-cli v1.8.0 // @grafana/grafana-developer-enablement-squad
	github.com/gogo/protobuf v1.3.2 // indirect; @grafana/alerting-backend
	github.com/google/go-cmp v0.7.0 // @grafana/grafana-backend-group
	github.com/google/go-github/v69 v69.2.0 // @grafana/grafana-developer-enablement-squad
	github.com/google/uuid v1.6.0 // indirect; @grafana/grafana-backend-group
	github.com/googleapis/gax-go/v2 v2.14.1 // indirect; @grafana/grafana-backend-group
	github.com/jmespath/go-jmespath v0.4.0 // indirect; @grafana/grafana-backend-group
	github.com/stretchr/testify v1.10.0 // @grafana/grafana-backend-group
	github.com/urfave/cli v1.22.16 // @grafana/grafana-backend-group
	github.com/urfave/cli/v2 v2.27.1 // @grafana/grafana-backend-group
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.59.0 // indirect; @grafana/plugins-platform-backend
	go.opentelemetry.io/otel v1.34.0 // indirect; @grafana/grafana-backend-group
	go.opentelemetry.io/otel/sdk v1.34.0 // indirect; @grafana/grafana-backend-group
	go.opentelemetry.io/otel/trace v1.34.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/crypto v0.35.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/mod v0.22.0 // @grafana/grafana-backend-group
	golang.org/x/net v0.35.0 // indirect; @grafana/oss-big-tent @grafana/partner-datasources
	golang.org/x/oauth2 v0.27.0 // @grafana/identity-access-team
	golang.org/x/sync v0.11.0 // indirect; @grafana/alerting-backend
	golang.org/x/text v0.22.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/time v0.9.0 // indirect; @grafana/grafana-backend-group
	google.golang.org/api v0.216.0 // @grafana/grafana-backend-group
	google.golang.org/grpc v1.70.0 // indirect; @grafana/plugins-platform-backend
	google.golang.org/protobuf v1.36.5 // indirect; @grafana/plugins-platform-backend
	gopkg.in/yaml.v3 v3.0.1 // @grafana/alerting-backend
)

require (
	cloud.google.com/go v0.116.0 // indirect
	cloud.google.com/go/auth v0.13.0 // indirect
	cloud.google.com/go/auth/oauth2adapt v0.2.6 // indirect
	cloud.google.com/go/compute/metadata v0.6.0 // indirect
	cloud.google.com/go/iam v1.2.1 // indirect
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/bmatcuk/doublestar v1.3.4 // indirect
	github.com/buildkite/yaml v2.1.0+incompatible // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.5 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/docker/go-connections v0.5.0 // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/drone-runners/drone-runner-docker v1.8.3 // indirect
	github.com/drone/drone-go v1.7.1 // indirect
	github.com/drone/envsubst v1.0.3 // indirect
	github.com/drone/runner-go v1.12.0 // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/ghodss/yaml v1.0.1-0.20190212211648-25d852aebe32 // indirect
	github.com/go-logr/logr v1.4.2 // indirect; @grafana/grafana-app-platform-squad
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/google/go-querystring v1.1.0 // indirect
	github.com/google/s2a-go v0.1.8 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.4 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.1.0 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/xrash/smetrics v0.0.0-20201216005158-039620a65673 // indirect
	go.opencensus.io v0.24.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.59.0 // indirect
	go.opentelemetry.io/otel/metric v1.34.0 // indirect
	go.starlark.net v0.0.0-20230525235612-a134d8f9ddca // indirect
	golang.org/x/sys v0.30.0 // indirect
	google.golang.org/genproto v0.0.0-20241021214115-324edc3d5d38 // indirect; @grafana/grafana-backend-group
	google.golang.org/genproto/googleapis/api v0.0.0-20250115164207-1a7da9e5054f // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250115164207-1a7da9e5054f // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
)

require dagger.io/dagger v0.11.8-rc.2

require (
	github.com/99designs/gqlgen v0.17.44 // indirect
	github.com/Azure/go-ansiterm v0.0.0-20230124172434-306776ec8161 // indirect
	github.com/Khan/genqlient v0.7.0 // indirect
	github.com/adrg/xdg v0.4.0 // indirect
	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
	github.com/containerd/log v0.1.0 // indirect
	github.com/distribution/reference v0.6.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.25.1 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/moby/docker-image-spec v1.3.1 // indirect
	github.com/moby/term v0.5.0 // indirect
	github.com/sosodev/duration v1.2.0 // indirect
	github.com/vektah/gqlparser/v2 v2.5.20 // indirect
	go.opentelemetry.io/auto/sdk v1.1.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.0.0-20240518090000-14441aefdf88 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.4.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.34.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.34.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.34.0 // indirect
	go.opentelemetry.io/otel/log v0.4.0 // indirect
	go.opentelemetry.io/otel/sdk/log v0.4.0 // indirect
	go.opentelemetry.io/proto/otlp v1.5.0 // indirect
	golang.org/x/exp v0.0.0-20240909161429-701f63a606c0 // indirect
	gotest.tools/v3 v3.5.1 // indirect
)

// Use fork of crewjam/saml with fixes for some issues until changes get merged into upstream
replace github.com/crewjam/saml => github.com/grafana/saml v0.4.15-0.20240523142256-cc370b98af7c

// Use our fork of the upstream alertmanagers.
// This is required in order to get notification delivery errors from the receivers API.
replace github.com/prometheus/alertmanager => github.com/grafana/prometheus-alertmanager v0.25.1-0.20240625192351-66ec17e3aa45

exclude github.com/mattn/go-sqlite3 v2.0.3+incompatible

// Use our fork xorm. go.work currently overrides this and points to the local ./pkg/util/xorm directory.
replace xorm.io/xorm => github.com/grafana/grafana/pkg/util/xorm v0.0.1
