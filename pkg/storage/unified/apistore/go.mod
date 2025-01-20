module github.com/grafana/grafana/pkg/storage/unified/apistore

go 1.23.5

replace (
	github.com/grafana/grafana => ../../../..
	github.com/grafana/grafana/pkg/apimachinery => ../../../apimachinery
	github.com/grafana/grafana/pkg/apiserver => ../../../apiserver
	github.com/grafana/grafana/pkg/storage/unified/resource => ../resource
)

exclude k8s.io/client-go v12.0.0+incompatible

require (
	github.com/bwmarrin/snowflake v0.3.0
	github.com/google/uuid v1.6.0
	github.com/grafana/authlib/types v0.0.0-20250120145936-5f0e28e7a87c
	github.com/grafana/grafana v0.0.0-00010101000000-000000000000
	github.com/grafana/grafana/pkg/apimachinery v0.0.0-20240821155123-6891eb1d35da
	github.com/grafana/grafana/pkg/apiserver v0.0.0-20240821155123-6891eb1d35da
	github.com/grafana/grafana/pkg/storage/unified/resource v0.0.0-20240821161612-71f0dae39e9d
	github.com/stretchr/testify v1.10.0
	gocloud.dev v0.40.0
	golang.org/x/exp v0.0.0-20240909161429-701f63a606c0
	google.golang.org/grpc v1.69.4
	k8s.io/apimachinery v0.32.0
	k8s.io/apiserver v0.32.0
	k8s.io/client-go v0.32.0
	k8s.io/klog/v2 v2.130.1
)

require (
	cel.dev/expr v0.18.0 // indirect
	cloud.google.com/go v0.116.0 // indirect
	cloud.google.com/go/auth v0.13.0 // indirect
	cloud.google.com/go/auth/oauth2adapt v0.2.6 // indirect
	cloud.google.com/go/compute/metadata v0.6.0 // indirect
)
