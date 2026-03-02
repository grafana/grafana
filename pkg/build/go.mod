module github.com/grafana/grafana/pkg/build

go 1.25.7

// Override docker/docker to avoid:
// go: github.com/drone-runners/drone-runner-docker@v1.8.2 requires
// github.com/docker/docker@v0.0.0-00010101000000-000000000000: invalid version: unknown revision 000000000000
// Updated to v28.5.2 to fix compatibility with testcontainers-go v0.40.0
replace github.com/docker/docker => github.com/moby/moby v28.5.2+incompatible

replace (
	// TODO: remove these - the build system should not depend on Grafana code.
	github.com/grafana/grafana/pkg/apimachinery => ../apimachinery
	github.com/grafana/grafana/pkg/plugins => ../plugins
	github.com/grafana/grafana/pkg/semconv => ../semconv
)

require (
	github.com/google/uuid v1.6.0 // indirect; @grafana/grafana-backend-group
	github.com/urfave/cli/v2 v2.27.7 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel v1.40.0 // indirect; @grafana/grafana-backend-group
	go.opentelemetry.io/otel/sdk v1.40.0 // indirect; @grafana/grafana-backend-group
	go.opentelemetry.io/otel/trace v1.40.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/net v0.51.0 // indirect; @grafana/oss-big-tent @grafana/partner-datasources
	golang.org/x/sync v0.19.0 // @grafana/alerting-backend
	golang.org/x/text v0.34.0 // indirect; @grafana/grafana-backend-group
	google.golang.org/grpc v1.79.1 // indirect; @grafana/plugins-platform-backend
	google.golang.org/protobuf v1.36.11 // indirect; @grafana/plugins-platform-backend
)

require (
	github.com/cpuguy83/go-md2man/v2 v2.0.7 // indirect
	github.com/go-logr/logr v1.4.3 // indirect; @grafana/grafana-app-platform-squad
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/xrash/smetrics v0.0.0-20240521201337-686a1a2994c1 // indirect
	go.opentelemetry.io/otel/metric v1.40.0 // indirect
	golang.org/x/sys v0.41.0 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20260209200024-4cfbd4190f57 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260209200024-4cfbd4190f57 // indirect
)

require (
	dagger.io/dagger v0.18.8
	github.com/Masterminds/semver v1.5.0
	github.com/grafana/grafana/pkg/plugins v0.0.0-00010101000000-000000000000
	github.com/quasilyte/go-ruleguard/dsl v0.3.22
	github.com/urfave/cli/v3 v3.5.0
)

require (
	github.com/99designs/gqlgen v0.17.73 // indirect
	github.com/Khan/genqlient v0.8.1 // indirect
	github.com/adrg/xdg v0.5.3 // indirect
	github.com/cenkalti/backoff/v5 v5.0.3 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/fxamacker/cbor/v2 v2.9.0 // indirect
	github.com/grafana/grafana/pkg/apimachinery v0.0.0 // indirect
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.27.8 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.3-0.20250322232337-35a7c28c31ee // indirect
	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3 // indirect
	github.com/sosodev/duration v1.3.1 // indirect
	github.com/vektah/gqlparser/v2 v2.5.27 // indirect
	github.com/x448/float16 v0.8.4 // indirect
	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.15.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.15.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.39.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.39.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.40.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0 // indirect
	go.opentelemetry.io/otel/log v0.15.0 // indirect
	go.opentelemetry.io/otel/sdk/log v0.15.0 // indirect
	go.opentelemetry.io/otel/sdk/metric v1.40.0 // indirect
	go.opentelemetry.io/proto/otlp v1.9.0 // indirect
	go.yaml.in/yaml/v2 v2.4.3 // indirect
	gopkg.in/inf.v0 v0.9.1 // indirect
	k8s.io/apimachinery v0.35.1 // indirect
	k8s.io/klog/v2 v2.130.1 // indirect
	k8s.io/kube-openapi v0.0.0-20260127142750-a19766b6e2d4 // indirect
	k8s.io/utils v0.0.0-20251002143259-bc988d571ff4 // indirect
	sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 // indirect
	sigs.k8s.io/randfill v1.0.0 // indirect
	sigs.k8s.io/structured-merge-diff/v6 v6.3.2 // indirect
)

// Use fork of crewjam/saml with fixes for some issues until changes get merged into upstream
replace github.com/crewjam/saml => github.com/grafana/saml v0.4.15-0.20240523142256-cc370b98af7c

// Use our fork of the upstream alertmanagers.
// This is required in order to get notification delivery errors from the receivers API.
replace github.com/prometheus/alertmanager => github.com/grafana/prometheus-alertmanager v0.25.1-0.20240625192351-66ec17e3aa45
