module github.com/grafana/alerting-api

go 1.15

require (
	github.com/grafana/grafana v1.9.2-0.20210308201921-4ce0a49eac03
	github.com/prometheus/alertmanager v0.21.1-0.20210211203738-a7ca7b1d2951
	github.com/prometheus/client_golang v1.9.0
	github.com/prometheus/common v0.18.1-0.20210305175002-2a23014b3b39
	github.com/prometheus/prometheus v1.8.2-0.20201105135750-00f16d1ac3a4
	github.com/stretchr/testify v1.7.0
	gopkg.in/yaml.v3 v3.0.0-20210107192922-496545a6307b
)

// **WARNING** below are cortex replace directives, copied for compatibility

// Override since git.apache.org is down.  The docs say to fetch from github.
replace git.apache.org/thrift.git => github.com/apache/thrift v0.0.0-20180902110319-2566ecd5d999

replace k8s.io/client-go => k8s.io/client-go v0.19.2

replace k8s.io/api => k8s.io/api v0.19.4

// >v1.2.0 has some conflict with prometheus/alertmanager. Hence prevent the upgrade till it's fixed.
replace github.com/satori/go.uuid => github.com/satori/go.uuid v1.2.0

// Use fork of gocql that has gokit logs and Prometheus metrics.
replace github.com/gocql/gocql => github.com/grafana/gocql v0.0.0-20200605141915-ba5dc39ece85

// We can't upgrade until grpc upgrade is unblocked.
replace github.com/sercand/kuberesolver => github.com/sercand/kuberesolver v2.4.0+incompatible

// Using a 3rd-party branch for custom dialer - see https://github.com/bradfitz/gomemcache/pull/86
replace github.com/bradfitz/gomemcache => github.com/themihai/gomemcache v0.0.0-20180902122335-24332e2d58ab

// Fix a panic (see: https://github.com/opentracing-contrib/go-grpc/pull/12)
replace github.com/opentracing-contrib/go-grpc => github.com/pracucci/go-grpc v0.0.0-20201022134131-ef559b8db645

// Pin github.com/go-openapi versions to match Prometheus alertmanager to avoid
// breaking changing affecting the alertmanager.
replace github.com/go-openapi/errors => github.com/go-openapi/errors v0.19.4

replace github.com/go-openapi/loads => github.com/go-openapi/loads v0.19.5

replace github.com/go-openapi/runtime => github.com/go-openapi/runtime v0.19.15

replace github.com/go-openapi/spec => github.com/go-openapi/spec v0.19.8

replace github.com/go-openapi/strfmt => github.com/go-openapi/strfmt v0.19.5

replace github.com/go-openapi/swag => github.com/go-openapi/swag v0.19.9

replace github.com/go-openapi/validate => github.com/go-openapi/validate v0.19.8
