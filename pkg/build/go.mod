module github.com/grafana/grafana/pkg/build

go 1.21.10

// Override docker/docker to avoid:
// go: github.com/drone-runners/drone-runner-docker@v1.8.2 requires
// github.com/docker/docker@v0.0.0-00010101000000-000000000000: invalid version: unknown revision 000000000000
replace github.com/docker/docker => github.com/moby/moby v23.0.4+incompatible

// contains openapi encoder fixes. remove ASAP
replace cuelang.org/go => github.com/grafana/cue v0.0.0-20230926092038-971951014e3f // @grafana/grafana-as-code

// Override Prometheus version because Prometheus v2.X is tagged as v0.X for Go modules purposes and Go assumes
// that v1.Y is higher than v0.X, so when we resolve dependencies if any dependency imports v1.Y we'd
// import that instead of v0.X even though v0.X is newer.
replace github.com/prometheus/prometheus => github.com/prometheus/prometheus v0.49.0

require (
	cloud.google.com/go/storage v1.36.0 // @grafana/backend-platform
	github.com/aws/aws-sdk-go v1.50.8 // @grafana/aws-datasources
	github.com/blang/semver/v4 v4.0.0 // @grafana/grafana-release-guild
	github.com/gogo/protobuf v1.3.2 // indirect; @grafana/alerting-squad-backend
	github.com/google/go-cmp v0.6.0 // @grafana/backend-platform
	github.com/google/uuid v1.6.0 // indirect; @grafana/backend-platform
	github.com/jmespath/go-jmespath v0.4.0 // indirect; @grafana/backend-platform
	github.com/pkg/errors v0.9.1 // indirect
	github.com/stretchr/testify v1.9.0 // @grafana/backend-platform
	github.com/urfave/cli v1.22.14 // @grafana/grafana-backend-group
	github.com/urfave/cli/v2 v2.25.0 // @grafana/backend-platform
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.49.0 // indirect; @grafana/plugins-platform-backend
	go.opentelemetry.io/otel/sdk v1.24.0 // indirect; @grafana/backend-platform
	go.opentelemetry.io/otel/trace v1.24.0 // indirect; @grafana/backend-platform
	golang.org/x/crypto v0.21.0 // indirect; @grafana/backend-platform
	golang.org/x/net v0.23.0 // indirect; @grafana/oss-big-tent @grafana/partner-datasources
	golang.org/x/oauth2 v0.18.0 // @grafana/grafana-authnz-team
	golang.org/x/sync v0.6.0 // indirect; @grafana/alerting-squad-backend
	golang.org/x/time v0.5.0 // indirect; @grafana/backend-platform
	golang.org/x/tools v0.17.0 // indirect; @grafana/grafana-as-code
	google.golang.org/api v0.155.0 // @grafana/backend-platform
	google.golang.org/grpc v1.62.1 // indirect; @grafana/plugins-platform-backend
	google.golang.org/protobuf v1.33.0 // indirect; @grafana/plugins-platform-backend
	gopkg.in/yaml.v3 v3.0.1 // @grafana/alerting-squad-backend
)

require (
	github.com/docker/go-units v0.5.0 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/golang/protobuf v1.5.3 // indirect; @grafana/backend-platform
	github.com/googleapis/gax-go/v2 v2.12.0 // indirect; @grafana/backend-platform
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	go.opencensus.io v0.24.0 // indirect
	golang.org/x/sys v0.18.0 // indirect
	golang.org/x/text v0.14.0 // indirect; @grafana/backend-platform
	golang.org/x/xerrors v0.0.0-20231012003039-104605ab7028 // indirect
	google.golang.org/appengine v1.6.8 // indirect
	google.golang.org/genproto v0.0.0-20240123012728-ef4313101c80 // indirect; @grafana/backend-platform
)

require (
	github.com/Masterminds/semver/v3 v3.1.1 // @grafana/grafana-release-guild
	golang.org/x/mod v0.14.0 // @grafana/backend-platform
)

require go.opentelemetry.io/otel v1.24.0 // indirect; @grafana/backend-platform

require (
	cloud.google.com/go v0.112.0 // indirect
	cloud.google.com/go/compute/metadata v0.2.3 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.3 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/google/s2a-go v0.1.7 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.2 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/xrash/smetrics v0.0.0-20201216005158-039620a65673 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.49.0 // indirect
	go.opentelemetry.io/otel/metric v1.24.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20240123012728-ef4313101c80 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240123012728-ef4313101c80 // indirect
)

require (
	cloud.google.com/go/compute v1.23.3 // indirect
	cloud.google.com/go/iam v1.1.5 // indirect
	github.com/go-logr/logr v1.4.1 // indirect; @grafana/grafana-app-platform-squad
	github.com/go-logr/stdr v1.2.2 // indirect
)

require (
	github.com/docker/docker v24.0.7+incompatible
	github.com/drone/drone-cli v1.8.0
	github.com/google/go-github v17.0.0+incompatible
	github.com/google/go-github/v45 v45.2.0
)

require (
	github.com/Microsoft/go-winio v0.6.1 // indirect
	github.com/bmatcuk/doublestar v1.1.1 // indirect
	github.com/buildkite/yaml v2.1.0+incompatible // indirect
	github.com/docker/distribution v2.8.2+incompatible // indirect
	github.com/docker/go-connections v0.4.0 // indirect
	github.com/drone-runners/drone-runner-docker v1.8.3 // indirect
	github.com/drone/drone-go v1.7.1 // indirect
	github.com/drone/envsubst v1.0.3 // indirect
	github.com/drone/runner-go v1.12.0 // indirect
	github.com/ghodss/yaml v1.0.0 // indirect
	github.com/google/go-querystring v1.1.0 // indirect
	github.com/kr/pretty v0.3.1 // indirect
	github.com/moby/term v0.0.0-20221205130635-1aeaba878587 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.3-0.20220512140940-7b36cea86235 // indirect
	github.com/rogpeppe/go-internal v1.11.0 // indirect
	go.starlark.net v0.0.0-20221020143700-22309ac47eac // indirect
	gopkg.in/check.v1 v1.0.0-20201130134442-10cb98267c6c // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gotest.tools/v3 v3.0.3 // indirect
)

// Use fork of crewjam/saml with fixes for some issues until changes get merged into upstream
replace github.com/crewjam/saml => github.com/grafana/saml v0.4.15-0.20231025143828-a6c0e9b86a4c

// replace github.com/google/cel-go => github.com/google/cel-go v0.16.1

// Thema's thema CLI requires cobra, which eventually works its way down to go-hclog@v1.0.0.
// Upgrading affects backend plugins: https://github.com/grafana/grafana/pull/47653#discussion_r850508593
// No harm to Thema because it's only a dependency in its main package.
replace github.com/hashicorp/go-hclog => github.com/hashicorp/go-hclog v0.16.1

// Use our fork of the upstream alertmanagers.
// This is required in order to get notification delivery errors from the receivers API.
replace github.com/prometheus/alertmanager => github.com/grafana/prometheus-alertmanager v0.25.1-0.20240208102907-e82436ce63e6

exclude github.com/mattn/go-sqlite3 v2.0.3+incompatible

// Use our fork xorm. go.work currently overrides this and points to the local ./pkg/util/xorm directory.
replace xorm.io/xorm => github.com/grafana/grafana/pkg/util/xorm v0.0.1
