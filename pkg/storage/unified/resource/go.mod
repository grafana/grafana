module github.com/grafana/grafana/pkg/storage/unified/resource

go 1.23.1

require (
	github.com/fullstorydev/grpchan v1.1.1
	github.com/google/uuid v1.6.0
	github.com/grafana/authlib v0.0.0-20240906122029-0100695765b9
	github.com/grafana/authlib/claims v0.0.0-20240903121118-16441568af1e
	github.com/grafana/grafana/pkg/apimachinery v0.0.0-20240808164224-787abccfbc9e
	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.1.0
	github.com/prometheus/client_golang v1.20.3
	github.com/stretchr/testify v1.9.0
	go.opentelemetry.io/otel/trace v1.29.0
	gocloud.dev v0.39.0
	google.golang.org/grpc v1.66.0
	google.golang.org/protobuf v1.34.2
	k8s.io/apimachinery v0.31.3
)
