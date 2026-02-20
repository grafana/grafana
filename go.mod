module github.com/grafana/grafana

go 1.25.7

// Direct requirements -- every entry needs an owner
require (
	buf.build/gen/go/parca-dev/parca/connectrpc/go v1.18.1-20250703125925-3f0fcf4bff96.1 // @grafana/observability-traces-and-profiling
	buf.build/gen/go/parca-dev/parca/protocolbuffers/go v1.36.2-20250703125925-3f0fcf4bff96.1 // @grafana/observability-traces-and-profiling
	cloud.google.com/go/kms v1.22.0 // @grafana/grafana-backend-group
	cloud.google.com/go/storage v1.56.0 // @grafana/grafana-backend-group
	connectrpc.com/connect v1.19.1 // @grafana/observability-traces-and-profiling
	cuelang.org/go v0.11.1 // indirect; @grafana/grafana-as-code
	dario.cat/mergo v1.0.2 // @grafana/grafana-app-platform-squad
	filippo.io/age v1.2.1 // @grafana/identity-access-team
	github.com/1NCE-GmbH/grpc-go-pool v0.0.0-20231117122434-2a5bb974daa2 // @grafana/grafana-search-and-storage
	github.com/Azure/azure-sdk-for-go v68.0.0+incompatible // @grafana/partner-datasources
	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.19.1 // @grafana/identity-access-team
	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.12.0 // @grafana/grafana-backend-group
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/azkeys v0.10.0 // @grafana/grafana-backend-group
	github.com/Azure/azure-storage-blob-go v0.15.0 // @grafana/grafana-backend-group
	github.com/Azure/go-autorest/autorest v0.11.29 // @grafana/grafana-backend-group
	github.com/Azure/go-autorest/autorest/adal v0.9.24 // @grafana/grafana-backend-group
	github.com/Bose/minisentinel v0.0.0-20200130220412-917c5a9223bb // @grafana/alerting-backend
	github.com/BurntSushi/toml v1.5.0 // @grafana/identity-access-team
	github.com/DATA-DOG/go-sqlmock v1.5.2 // @grafana/grafana-search-and-storage
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-group
	github.com/Masterminds/semver/v3 v3.4.0 // @grafana/grafana-developer-enablement-squad
	github.com/Masterminds/sprig/v3 v3.3.0 // @grafana/grafana-backend-group
	github.com/VividCortex/mysqlerr v1.0.0 // @grafana/grafana-backend-group
	github.com/alicebob/miniredis/v2 v2.34.0 // @grafana/alerting-backend
	github.com/andybalholm/brotli v1.2.0 // @grafana/partner-datasources
	github.com/apache/arrow-go/v18 v18.5.1 // @grafana/plugins-platform-backend
	github.com/armon/go-radix v1.0.0 // @grafana/grafana-app-platform-squad
	github.com/aws/aws-sdk-go v1.55.7 // @grafana/aws-datasources
	github.com/aws/aws-sdk-go-v2 v1.41.1 // @grafana/aws-datasources
	github.com/aws/aws-sdk-go-v2/credentials v1.19.7 // @grafana/grafana-operator-experience-squad
	github.com/aws/aws-sdk-go-v2/service/cloudwatch v1.45.3 // @grafana/aws-datasources
	github.com/aws/aws-sdk-go-v2/service/cloudwatchlogs v1.51.0 // @grafana/aws-datasources
	github.com/aws/aws-sdk-go-v2/service/ec2 v1.225.2 // @grafana/aws-datasources
	github.com/aws/aws-sdk-go-v2/service/oam v1.18.3 // @grafana/aws-datasources
	github.com/aws/aws-sdk-go-v2/service/resourcegroupstaggingapi v1.26.6 // @grafana/aws-datasources
	github.com/aws/aws-sdk-go-v2/service/secretsmanager v1.40.1 // @grafana/grafana-operator-experience-squad
	github.com/aws/aws-sdk-go-v2/service/sts v1.41.6 // @grafana/grafana-operator-experience-squad
	github.com/aws/smithy-go v1.24.0 // @grafana/aws-datasources
	github.com/beevik/etree v1.4.1 // @grafana/grafana-backend-group
	github.com/benbjohnson/clock v1.3.5 // @grafana/alerting-backend
	github.com/blang/semver/v4 v4.0.0 // indirect; @grafana/grafana-developer-enablement-squad
	github.com/blevesearch/bleve/v2 v2.5.7 // @grafana/grafana-search-and-storage
	github.com/blevesearch/bleve_index_api v1.3.0 // @grafana/grafana-search-and-storage
	github.com/bradfitz/gomemcache v0.0.0-20250403215159-8d39553ac7cf // @grafana/grafana-backend-group
	github.com/bwmarrin/snowflake v0.3.0 // @grafana/grafana-app-platform-squad
	github.com/centrifugal/centrifuge v0.38.0 // @grafana/grafana-app-platform-squad
	github.com/crewjam/saml v0.4.14 // @grafana/identity-access-team
	github.com/dgraph-io/badger/v4 v4.9.1 // @grafana/grafana-search-and-storage
	github.com/dlmiddlecote/sqlstats v1.0.2 // @grafana/grafana-backend-group
	github.com/docker/go-connections v0.6.0 // @grafana/grafana-app-platform-squad
	github.com/dolthub/go-mysql-server v0.19.1-0.20250410182021-5632d67cd46e // @grafana/grafana-datasources-core-services
	github.com/dolthub/vitess v0.0.0-20250930230441-70c2c6a98e33 // @grafana/grafana-datasources-core-services
	github.com/dustin/go-humanize v1.0.1 // @grafana/observability-traces-and-profiling
	github.com/emicklei/go-restful/v3 v3.13.0 // @grafana/grafana-app-platform-squad
	github.com/fatih/color v1.18.0 // @grafana/grafana-backend-group
	github.com/fullstorydev/grpchan v1.1.1 // @grafana/grafana-backend-group
	github.com/gchaincl/sqlhooks v1.3.0 // @grafana/grafana-search-and-storage
	github.com/getkin/kin-openapi v0.133.0 // @grafana/grafana-app-platform-squad
	github.com/go-jose/go-jose/v4 v4.1.3 // @grafana/identity-access-team
	github.com/go-kit/log v0.2.1 //  @grafana/grafana-backend-group
	github.com/go-ldap/ldap/v3 v3.4.4 // @grafana/identity-access-team
	github.com/go-logfmt/logfmt v0.6.1 // @grafana/oss-big-tent
	github.com/go-openapi/loads v0.23.2 // @grafana/alerting-backend
	github.com/go-openapi/runtime v0.28.0 // @grafana/alerting-backend
	github.com/go-openapi/strfmt v0.25.0 // @grafana/alerting-backend
	github.com/go-redis/redis/v8 v8.11.5 // indirect; @grafana/grafana-backend-group
	github.com/go-sourcemap/sourcemap v2.1.4+incompatible // @grafana/grafana-backend-group
	github.com/go-sql-driver/mysql v1.9.3 // @grafana/grafana-search-and-storage
	github.com/go-stack/stack v1.8.1 // @grafana/grafana-backend-group
	github.com/gobwas/glob v0.2.3 // @grafana/grafana-backend-group
	github.com/gogo/protobuf v1.3.2 // @grafana/alerting-backend
	github.com/golang-jwt/jwt/v4 v4.5.2 // @grafana/grafana-backend-group
	github.com/golang-migrate/migrate/v4 v4.7.0 // @grafana/grafana-backend-group
	github.com/golang/mock v1.7.0-rc.1 // @grafana/alerting-backend
	github.com/golang/protobuf v1.5.4 // @grafana/grafana-backend-group
	github.com/golang/snappy v1.0.0 // @grafana/alerting-backend
	github.com/google/go-cmp v0.7.0 // @grafana/grafana-backend-group
	github.com/google/go-github/v82 v82.0.0 // @grafana/grafana-git-ui-sync-team
	github.com/google/go-querystring v1.2.0 // indirect; @grafana/oss-big-tent
	github.com/google/uuid v1.6.0 // @grafana/grafana-backend-group
	github.com/google/wire v0.7.0 // @grafana/grafana-backend-group
	github.com/googleapis/gax-go/v2 v2.15.0 // @grafana/grafana-backend-group
	github.com/gorilla/mux v1.8.1 // @grafana/grafana-backend-group
	github.com/gorilla/websocket v1.5.4-0.20250319132907-e064f32e3674 // @grafana/grafana-app-platform-squad
	github.com/grafana/alerting v0.0.0-20260220113344-1de0d0f76785 // @grafana/alerting-backend
	github.com/grafana/authlib v0.0.0-20260203153107-16a114a99f67 // @grafana/identity-access-team
	github.com/grafana/authlib/types v0.0.0-20260203131350-b83e80394acc // @grafana/identity-access-team
	github.com/grafana/dataplane/examples v0.0.1 // @grafana/observability-metrics
	github.com/grafana/dataplane/sdata v0.0.9 // @grafana/observability-metrics
	github.com/grafana/dskit v0.0.0-20260108123158-1a1acfb6ef2e // @grafana/grafana-backend-group
	github.com/grafana/e2e v0.1.1 // @grafana-app-platform-squad
	github.com/grafana/gofpdf v0.0.0-20250307124105-3b9c5d35577f // @grafana/sharing-squad
	github.com/grafana/gomemcache v0.0.0-20251127154401-74f93547077b // @grafana/grafana-operator-experience-squad
	github.com/grafana/grafana-api-golang-client v0.27.0 // @grafana/alerting-backend
	github.com/grafana/grafana-app-sdk v0.51.4 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana-app-sdk/logging v0.51.4 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana-aws-sdk v1.4.3 // @grafana/aws-datasources
	github.com/grafana/grafana-azure-sdk-go/v2 v2.3.1 // @grafana/partner-datasources
	github.com/grafana/grafana-cloud-migration-snapshot v1.10.0 // @grafana/grafana-operator-experience-squad
	github.com/grafana/grafana-google-sdk-go v0.4.2 // @grafana/partner-datasources
	github.com/grafana/grafana-openapi-client-go v0.0.0-20231213163343-bd475d63fb79 // @grafana/grafana-backend-group
	github.com/grafana/grafana-plugin-sdk-go v0.289.0 // @grafana/plugins-platform-backend
	github.com/grafana/loki/pkg/push v0.0.0-20250823105456-332df2b20000 // @grafana/alerting-backend
	github.com/grafana/loki/v3 v3.2.1 // @grafana/observability-logs
	github.com/grafana/nanogit v0.3.5 // indirect; @grafana/grafana-git-ui-sync-team
	github.com/grafana/otel-profiling-go v0.5.1 // @grafana/grafana-backend-group
	github.com/grafana/pyroscope-go/godeltaprof v0.1.9 // @grafana/observability-traces-and-profiling
	github.com/grafana/pyroscope/api v1.2.1-0.20251118081820-ace37f973a0f // @grafana/observability-traces-and-profiling
	github.com/grafana/tempo v1.5.1-0.20250529124718-87c2dc380cec // @grafana/observability-traces-and-profiling
	github.com/grpc-ecosystem/go-grpc-middleware v1.4.0 // @grafana/grafana-search-and-storage
	github.com/grpc-ecosystem/go-grpc-middleware/providers/prometheus v1.1.0 // @grafana/plugins-platform-backend
	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.3.3 // @grafana/grafana-backend-group
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.27.7 // @grafana/identity-access-team
	github.com/hashicorp/go-hclog v1.6.3 // @grafana/plugins-platform-backend
	github.com/hashicorp/go-multierror v1.1.1 // @grafana/alerting-squad
	github.com/hashicorp/go-plugin v1.7.0 // @grafana/plugins-platform-backend
	github.com/hashicorp/go-version v1.7.0 // @grafana/grafana-backend-group
	github.com/hashicorp/golang-lru/v2 v2.0.7 // @grafana/alerting-backend
	github.com/hashicorp/hcl/v2 v2.24.0 // @grafana/alerting-backend
	github.com/huandu/xstrings v1.5.0 // @grafana/partner-datasources
	github.com/influxdata/influxdb-client-go/v2 v2.13.0 // @grafana/partner-datasources
	github.com/influxdata/influxql v1.4.0 // @grafana/partner-datasources
	github.com/influxdata/line-protocol v0.0.0-20210922203350-b1ad95c89adf // @grafana/grafana-app-platform-squad
	github.com/jackc/pgx/v5 v5.8.0 // @grafana/grafana-search-and-storage
	github.com/jmespath-community/go-jmespath v1.1.1 // @grafana/identity-access-team
	github.com/jmespath/go-jmespath v0.4.0 // indirect; // @grafana/grafana-backend-group
	github.com/jmoiron/sqlx v1.4.0 // @grafana/grafana-backend-group
	github.com/json-iterator/go v1.1.12 // @grafana/grafana-backend-group
	github.com/lib/pq v1.10.9 // @grafana/grafana-backend-group
	github.com/m3db/prometheus_remote_client_golang v0.4.4 // @grafana/grafana-backend-group
	github.com/madflojo/testcerts v1.4.0 // @grafana/alerting-backend
	github.com/mattn/go-isatty v0.0.20 // @grafana/grafana-backend-group
	github.com/mattn/go-sqlite3 v1.14.34 // @grafana/grafana-backend-group
	github.com/matttproud/golang_protobuf_extensions v1.0.4 // @grafana/alerting-backend
	github.com/microsoft/go-mssqldb v1.9.2 // @grafana/partner-datasources
	github.com/migueleliasweb/go-github-mock v1.5.0 // @grafana/grafana-git-ui-sync-team
	github.com/mitchellh/mapstructure v1.5.1-0.20231216201459-8508981c8b6c //@grafana/identity-access-team
	github.com/mocktools/go-smtp-mock/v2 v2.5.1 // @grafana/grafana-backend-group
	github.com/modern-go/reflect2 v1.0.3-0.20250322232337-35a7c28c31ee // @grafana/alerting-backend
	github.com/mwitkow/go-conntrack v0.0.0-20190716064945-2f068394615f // @grafana/grafana-operator-experience-squad
	github.com/olekukonko/tablewriter v1.1.3 // @grafana/grafana-backend-group
	github.com/open-feature/go-sdk v1.17.0 // @grafana/grafana-backend-group
	github.com/open-feature/go-sdk-contrib/providers/go-feature-flag v0.2.6 // @grafana/grafana-backend-group
	github.com/open-feature/go-sdk-contrib/providers/ofrep v0.1.7 // @grafana/grafana-backend-group
	github.com/openfga/api/proto v0.0.0-20260122164422-25e22cb1875b // @grafana/identity-access-team
	github.com/openfga/language/pkg/go v0.2.0-beta.2.0.20251027165255-0f8f255e5f6c // @grafana/identity-access-team
	github.com/openfga/openfga v1.11.3 // @grafana/identity-access-team
	github.com/opentracing-contrib/go-grpc v0.1.2 // @grafana/grafana-search-and-storage
	github.com/opentracing/opentracing-go v1.2.0 // @grafana/grafana-search-and-storage
	github.com/openzipkin/zipkin-go v0.4.3 // @grafana/oss-big-tent
	github.com/patrickmn/go-cache v2.1.0+incompatible // @grafana/alerting-backend
	github.com/phpdave11/gofpdi v1.0.14 // @grafana/sharing-squad
	github.com/pressly/goose/v3 v3.26.0 // @grafana/identity-access-team
	github.com/prometheus/alertmanager v0.28.2 // @grafana/alerting-backend
	github.com/prometheus/client_golang v1.23.2 // @grafana/alerting-backend
	github.com/prometheus/client_model v0.6.2 // @grafana/grafana-backend-group
	github.com/prometheus/common v0.67.5 // @grafana/alerting-backend
	github.com/prometheus/prometheus v0.303.1 // @grafana/alerting-backend
	github.com/prometheus/sigv4 v0.1.2 // @grafana/alerting-backend
	github.com/puzpuzpuz/xsync/v4 v4.2.0 // @grafana/grafana-backend-group
	github.com/redis/go-redis/v9 v9.14.0 // @grafana/alerting-backend
	github.com/robfig/cron/v3 v3.0.1 // @grafana/grafana-backend-group
	github.com/rs/cors v1.11.1 // @grafana/identity-access-team
	github.com/russellhaering/goxmldsig v1.4.0 // @grafana/grafana-backend-group
	github.com/shopspring/decimal v1.4.0 // @grafana/grafana-datasources-core-services
	github.com/spf13/cobra v1.10.2 // @grafana/grafana-app-platform-squad
	github.com/spf13/pflag v1.0.10 // @grafana-app-platform-squad
	github.com/spyzhov/ajson v0.9.6 // @grafana/grafana-sharing-squad
	github.com/stretchr/testify v1.11.1 // @grafana/grafana-backend-group
	github.com/testcontainers/testcontainers-go v0.36.0 //@grafana/grafana-app-platform-squad
	github.com/thomaspoignant/go-feature-flag v1.42.0 // @grafana/grafana-backend-group
	github.com/tjhop/slog-gokit v0.1.5 // @grafana/grafana-app-platform-squad
	github.com/ua-parser/uap-go v0.0.0-20250213224047-9c035f085b90 // @grafana/grafana-backend-group
	github.com/urfave/cli v1.22.17 // indirect; @grafana/grafana-backend-group
	github.com/urfave/cli/v2 v2.27.7 // @grafana/grafana-backend-group
	github.com/urfave/cli/v3 v3.6.2 // @grafana/grafana-backend-group
	github.com/wk8/go-ordered-map v1.0.0 // @grafana/grafana-backend-group
	github.com/xlab/treeprint v1.2.0 // @grafana/observability-traces-and-profiling
	github.com/youmark/pkcs8 v0.0.0-20240726163527-a2c0da244d78 // @grafana/grafana-operator-experience-squad
	github.com/yudai/gojsondiff v1.0.0 // @grafana/grafana-backend-group
	go.etcd.io/bbolt v1.4.3 // @grafana/grafana-search-and-storage
	go.opentelemetry.io/collector/pdata v1.44.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.64.0 // @grafana/plugins-platform-backend
	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.64.0 // @grafana/grafana-operator-experience-squad
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.64.0 // @grafana/sharing-squad
	go.opentelemetry.io/contrib/propagators/jaeger v1.39.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/contrib/samplers/jaegerremote v0.33.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel v1.40.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/jaeger v1.17.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.15.0 // indirect; @grafana/grafana-operator-experience-squad
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.40.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.40.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/log v0.15.0 // indirect; @grafana/grafana-operator-experience-squad
	go.opentelemetry.io/otel/sdk v1.40.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/sdk/log v0.15.0 // indirect; @grafana/grafana-operator-experience-squad
	go.opentelemetry.io/otel/trace v1.40.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/proto/otlp v1.9.0 // indirect; @grafana/grafana-operator-experience-squad
	go.uber.org/atomic v1.11.0 // @grafana/alerting-backend
	go.uber.org/goleak v1.3.0 // @grafana/grafana-search-and-storage
	go.uber.org/mock v0.6.0 // @grafana/grafana-operator-experience-squad
	go.uber.org/multierr v1.11.0 // @grafana/grafana-app-platform-squad
	go.uber.org/zap v1.27.1 // @grafana/identity-access-team
	go.yaml.in/yaml/v3 v3.0.4 // @grafana/alerting-backend
	gocloud.dev v0.44.0 // @grafana/grafana-app-platform-squad
	gocloud.dev/secrets/hashivault v0.44.0 // @grafana/grafana-operator-experience-squad
	golang.org/x/exp v0.0.0-20260112195511-716be5621a96 // @grafana/alerting-backend
	golang.org/x/mod v0.33.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/net v0.50.0 // @grafana/oss-big-tent @grafana/partner-datasources
	golang.org/x/oauth2 v0.35.0 // @grafana/identity-access-team
	golang.org/x/sync v0.19.0 // @grafana/alerting-backend
	golang.org/x/text v0.34.0 // @grafana/grafana-backend-group
	golang.org/x/time v0.14.0 // @grafana/grafana-backend-group
	golang.org/x/tools v0.42.0 // indirect; @grafana/grafana-as-code
	gonum.org/v1/gonum v0.17.0 // @grafana/oss-big-tent
	google.golang.org/api v0.247.0 // @grafana/grafana-backend-group
	google.golang.org/grpc v1.79.1 // @grafana/plugins-platform-backend
	google.golang.org/protobuf v1.36.11 // @grafana/plugins-platform-backend
	gopkg.in/ini.v1 v1.67.1 // @grafana/alerting-backend
	gopkg.in/mail.v2 v2.3.1 // @grafana/grafana-backend-group
	k8s.io/api v0.35.1 // @grafana/grafana-app-platform-squad
	k8s.io/apiextensions-apiserver v0.35.1 // @grafana/grafana-app-platform-squad
	k8s.io/apimachinery v0.35.1 // @grafana/grafana-app-platform-squad
	k8s.io/apiserver v0.35.1 // @grafana/grafana-app-platform-squad
	k8s.io/client-go v0.35.1 // @grafana/grafana-app-platform-squad
	k8s.io/component-base v0.35.1 // @grafana/grafana-app-platform-squad
	k8s.io/klog/v2 v2.130.1 // @grafana/grafana-app-platform-squad
	k8s.io/kube-aggregator v0.35.0 // @grafana/grafana-app-platform-squad
	k8s.io/kube-openapi v0.0.0-20260127142750-a19766b6e2d4 // @grafana/grafana-app-platform-squad
	k8s.io/utils v0.0.0-20251002143259-bc988d571ff4 // @grafana/partner-datasources
	modernc.org/sqlite v1.44.3 // @grafana/grafana-backend-group
	pgregory.net/rapid v1.2.0 // @grafana/grafana-operator-experience-squad
	sigs.k8s.io/randfill v1.0.0 // @grafana/grafana-app-platform-squad
	sigs.k8s.io/structured-merge-diff/v6 v6.3.2 // @grafana/grafana-app-platform-squad
	xorm.io/builder v0.3.13 // @grafana/grafana-backend-group
)

// Internal module references (every entry should also have a replace in the section below)
require (
	github.com/grafana/grafana/apps/advisor v0.0.0 // @grafana/plugins-platform-backend
	github.com/grafana/grafana/apps/alerting/alertenrichment v0.0.0 // @grafana/alerting-backend
	github.com/grafana/grafana/apps/alerting/historian v0.0.0 // @grafana/alerting-backend
	github.com/grafana/grafana/apps/alerting/notifications v0.0.0 // @grafana/alerting-backend
	github.com/grafana/grafana/apps/alerting/rules v0.0.0 // @grafana/alerting-backend
	github.com/grafana/grafana/apps/annotation v0.0.0 // @grafana/grafana-backend-services-squad
	github.com/grafana/grafana/apps/collections v0.0.0 // @grafana/grafana-app-platform-squad @grafana/grafana-frontend-platform
	github.com/grafana/grafana/apps/correlations v0.0.0 // @grafana/datapro
	github.com/grafana/grafana/apps/dashboard v0.0.0 // @grafana/grafana-app-platform-squad @grafana/dashboards-squad
	github.com/grafana/grafana/apps/dashvalidator v0.0.0 // @grafana/sharing-squad
	github.com/grafana/grafana/apps/example v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/apps/folder v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/apps/iam v0.0.0 // @grafana/access-squad
	github.com/grafana/grafana/apps/live v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/apps/logsdrilldown v0.0.0 // @grafana/observability-logs
	github.com/grafana/grafana/apps/playlist v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/apps/plugins v0.0.0 // @grafana/plugins-platform-backend
	github.com/grafana/grafana/apps/preferences v0.0.0 // @grafana/grafana-app-platform-squad @grafana/grafana-frontend-platform
	github.com/grafana/grafana/apps/provisioning v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/apps/quotas v0.0.0 // @grafana/grafana-search-and-storage
	github.com/grafana/grafana/apps/scope v0.0.0 // @grafana/grafana-operator-experience-squad
	github.com/grafana/grafana/apps/secret v0.0.0 // @grafana/grafana-operator-experience-squad
	github.com/grafana/grafana/apps/shorturl v0.0.0 // @grafana/sharing-squad
	github.com/grafana/grafana/pkg/aggregator v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/apimachinery v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/apiserver v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/plugins v0.0.0 // @grafana/plugins-platform-backend

	// This needs to be here for other projects that import grafana/grafana
	// For local development grafana/grafana will always use the local files
	// Check go.work file for details
	github.com/grafana/grafana/pkg/promlib v0.0.8 // @grafana/oss-big-tent
	github.com/grafana/grafana/pkg/semconv v0.0.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/storage/unified/resource/kv v0.0.0 // @grafana/grafana-search-and-storage
)

// Replace references to internal workspaces
replace (
	github.com/grafana/grafana/apps/advisor => ./apps/advisor
	github.com/grafana/grafana/apps/alerting/alertenrichment => ./apps/alerting/alertenrichment
	github.com/grafana/grafana/apps/alerting/historian => ./apps/alerting/historian
	github.com/grafana/grafana/apps/alerting/notifications => ./apps/alerting/notifications
	github.com/grafana/grafana/apps/alerting/rules => ./apps/alerting/rules
	github.com/grafana/grafana/apps/annotation => ./apps/annotation
	github.com/grafana/grafana/apps/collections => ./apps/collections
	github.com/grafana/grafana/apps/correlations => ./apps/correlations
	github.com/grafana/grafana/apps/dashboard => ./apps/dashboard
	github.com/grafana/grafana/apps/dashvalidator => ./apps/dashvalidator
	github.com/grafana/grafana/apps/example => ./apps/example
	github.com/grafana/grafana/apps/folder => ./apps/folder
	github.com/grafana/grafana/apps/iam => ./apps/iam
	github.com/grafana/grafana/apps/live => ./apps/live
	github.com/grafana/grafana/apps/logsdrilldown => ./apps/logsdrilldown
	github.com/grafana/grafana/apps/playlist => ./apps/playlist
	github.com/grafana/grafana/apps/plugins => ./apps/plugins
	github.com/grafana/grafana/apps/preferences => ./apps/preferences
	github.com/grafana/grafana/apps/provisioning => ./apps/provisioning
	github.com/grafana/grafana/apps/quotas => ./apps/quotas
	github.com/grafana/grafana/apps/scope => ./apps/scope
	github.com/grafana/grafana/apps/secret => ./apps/secret
	github.com/grafana/grafana/apps/shorturl => ./apps/shorturl

	// Packages
	github.com/grafana/grafana/pkg/aggregator => ./pkg/aggregator
	github.com/grafana/grafana/pkg/apimachinery => ./pkg/apimachinery
	github.com/grafana/grafana/pkg/apiserver => ./pkg/apiserver
	github.com/grafana/grafana/pkg/plugins => ./pkg/plugins
	github.com/grafana/grafana/pkg/semconv => ./pkg/semconv
	github.com/grafana/grafana/pkg/storage/unified/resource/kv => ./pkg/storage/unified/resource/kv
)

// Indirect references
require (
	cel.dev/expr v0.25.1 // indirect
	cloud.google.com/go v0.121.6 // indirect
	cloud.google.com/go/auth v0.16.4 // indirect
	cloud.google.com/go/auth/oauth2adapt v0.2.8 // indirect
	cloud.google.com/go/compute/metadata v0.9.0 // indirect
	cloud.google.com/go/iam v1.5.2 // indirect
	cloud.google.com/go/longrunning v0.6.7 // indirect
	cloud.google.com/go/monitoring v1.24.2 // indirect
	github.com/Azure/azure-pipeline-go v0.2.3 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/internal v1.11.2 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/internal v0.7.1 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/storage/azblob v1.6.1 // indirect
	github.com/Azure/go-ansiterm v0.0.0-20250102033503-faa5f7b0171c // indirect
	github.com/Azure/go-autorest v14.2.0+incompatible // indirect
	github.com/Azure/go-autorest/autorest/date v0.3.0 // indirect
	github.com/Azure/go-autorest/autorest/to v0.4.1 // indirect
	github.com/Azure/go-autorest/autorest/validation v0.3.1 // indirect
	github.com/Azure/go-autorest/logger v0.2.1 // indirect
	github.com/Azure/go-autorest/tracing v0.6.0 // indirect
	github.com/Azure/go-ntlmssp v0.0.0-20220621081337-cb9428e4ac1e // indirect
	github.com/AzureAD/microsoft-authentication-library-for-go v1.5.0 // indirect
	github.com/FZambia/eagle v0.2.0 // indirect
	github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.30.0 // indirect
	github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.53.0 // indirect
	github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.53.0 // indirect
	github.com/IBM/pgxpoolprometheus v1.1.2 // indirect
	github.com/Machiel/slugify v1.0.1 // indirect
	github.com/Masterminds/goutils v1.1.1 // indirect
	github.com/Masterminds/squirrel v1.5.4 // indirect
	github.com/Microsoft/go-winio v0.6.2 // indirect
	github.com/NYTimes/gziphandler v1.1.1 // indirect
	github.com/ProtonMail/go-crypto v1.3.0 // indirect
	github.com/RoaringBitmap/roaring/v2 v2.4.5 // indirect
	github.com/Yiling-J/theine-go v0.6.2 // indirect
	github.com/agext/levenshtein v1.2.1 // indirect
	github.com/alecthomas/units v0.0.0-20240927000941-0f3dac36c52b // indirect
	github.com/alicebob/gopher-json v0.0.0-20230218143504-906a9b012302 // indirect
	github.com/antlr4-go/antlr/v4 v4.13.1 // indirect
	github.com/apache/thrift v0.22.0 // indirect
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/apparentlymart/go-textseg/v15 v15.0.0 // indirect
	github.com/armon/go-metrics v0.4.1 // indirect
	github.com/at-wat/mqtt-go v0.19.6 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.7.3 // indirect
	github.com/aws/aws-sdk-go-v2/config v1.32.7 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.18.17 // indirect
	github.com/aws/aws-sdk-go-v2/feature/s3/manager v1.20.3 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.4.17 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.7.17 // indirect
	github.com/aws/aws-sdk-go-v2/internal/ini v1.8.4 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.4.13 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.13.4 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.9.4 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.13.17 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.19.13 // indirect
	github.com/aws/aws-sdk-go-v2/service/kms v1.41.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/s3 v1.89.2 // indirect
	github.com/aws/aws-sdk-go-v2/service/signin v1.0.5 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.30.9 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.35.13 // indirect
	github.com/bahlo/generic-list-go v0.2.0 // indirect
	github.com/barkimedes/go-deepcopy v0.0.0-20220514131651-17c30cfc62df // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/bits-and-blooms/bitset v1.22.0 // indirect
	github.com/blang/semver v3.5.1+incompatible // indirect
	github.com/blevesearch/geo v0.2.4 // indirect
	github.com/blevesearch/go-faiss v1.0.26 // indirect
	github.com/blevesearch/go-porterstemmer v1.0.3 // indirect
	github.com/blevesearch/gtreap v0.1.1 // indirect
	github.com/blevesearch/mmap-go v1.0.4 // indirect
	github.com/blevesearch/scorch_segment_api/v2 v2.3.13 // indirect
	github.com/blevesearch/segment v0.9.1 // indirect
	github.com/blevesearch/snowballstem v0.9.0 // indirect
	github.com/blevesearch/upsidedown_store_api v1.0.2 // indirect
	github.com/blevesearch/vellum v1.1.0 // indirect
	github.com/blevesearch/zapx/v11 v11.4.2 // indirect
	github.com/blevesearch/zapx/v12 v12.4.2 // indirect
	github.com/blevesearch/zapx/v13 v13.4.2 // indirect
	github.com/blevesearch/zapx/v14 v14.4.2 // indirect
	github.com/blevesearch/zapx/v15 v15.4.2 // indirect
	github.com/blevesearch/zapx/v16 v16.2.8 // indirect
	github.com/bluele/gcache v0.0.2 // indirect
	github.com/bufbuild/protocompile v0.14.1 // indirect
	github.com/buger/jsonparser v1.1.1 // indirect
	github.com/c2h5oh/datasize v0.0.0-20231215233829-aa82cc1e6500 // indirect
	github.com/cenkalti/backoff/v4 v4.3.0 // @grafana/alerting-backend
	github.com/cenkalti/backoff/v5 v5.0.3 // indirect
	github.com/centrifugal/protocol v0.17.0 // indirect
	github.com/cespare/xxhash v1.1.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/cheekybits/genny v1.0.0 // indirect
	github.com/chromedp/cdproto v0.0.0-20250803210736-d308e07a266d // indirect
	github.com/cloudflare/circl v1.6.1 // indirect
	github.com/cncf/xds/go v0.0.0-20251210132809-ee656c7534f5 // indirect
	github.com/cockroachdb/apd/v3 v3.2.1 // indirect
	github.com/containerd/errdefs v1.0.0 // indirect
	github.com/containerd/errdefs/pkg v0.3.0 // indirect
	github.com/containerd/log v0.1.0 // indirect
	github.com/containerd/platforms v0.2.1 // indirect
	github.com/coreos/go-semver v0.3.1 // indirect
	github.com/coreos/go-systemd/v22 v22.6.0 // indirect
	github.com/cpuguy83/dockercfg v0.3.2 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.7 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dennwc/varint v1.0.0 // indirect
	github.com/dgraph-io/ristretto/v2 v2.2.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/diegoholiveira/jsonlogic/v3 v3.7.4 // indirect
	github.com/distribution/reference v0.6.0 // indirect
	github.com/docker/docker v28.5.2+incompatible // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/dolthub/flatbuffers/v23 v23.3.3-dh.2 // indirect
	github.com/dolthub/jsonpath v0.0.2-0.20240227200619-19675ab05c71 // indirect
	github.com/dolthub/maphash v0.1.0 // indirect
	github.com/ebitengine/purego v0.8.2 // indirect
	github.com/edsrzf/mmap-go v1.2.0 // indirect
	github.com/elazarl/goproxy v1.8.0 // indirect
	github.com/emirpasic/gods v1.18.1 // indirect
	github.com/envoyproxy/go-control-plane/envoy v1.36.0 // indirect
	github.com/envoyproxy/protoc-gen-validate v1.3.0 // indirect
	github.com/facette/natsort v0.0.0-20181210072756-2cd4dd1e2dcb // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/fsnotify/fsnotify v1.9.0 // indirect
	github.com/fxamacker/cbor/v2 v2.9.0 // indirect
	github.com/gammazero/deque v0.2.1 // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.4 // indirect
	github.com/go-logr/logr v1.4.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-ole/go-ole v1.2.6 // indirect
	github.com/go-openapi/analysis v0.24.1 // indirect
	github.com/go-openapi/errors v0.22.4 // indirect
	github.com/go-openapi/jsonpointer v0.22.4 // indirect
	github.com/go-openapi/jsonreference v0.21.4 // indirect
	github.com/go-openapi/spec v0.22.3 // indirect
	github.com/go-openapi/swag v0.25.4 // indirect
	github.com/go-openapi/swag/cmdutils v0.25.4 // indirect
	github.com/go-openapi/swag/conv v0.25.4 // indirect
	github.com/go-openapi/swag/fileutils v0.25.4 // indirect
	github.com/go-openapi/swag/jsonname v0.25.4 // indirect
	github.com/go-openapi/swag/jsonutils v0.25.4 // indirect
	github.com/go-openapi/swag/loading v0.25.4 // indirect
	github.com/go-openapi/swag/mangling v0.25.4 // indirect
	github.com/go-openapi/swag/netutils v0.25.4 // indirect
	github.com/go-openapi/swag/stringutils v0.25.4 // indirect
	github.com/go-openapi/swag/typeutils v0.25.4 // indirect
	github.com/go-openapi/swag/yamlutils v0.25.4 // indirect
	github.com/go-openapi/validate v0.25.1 // indirect
	github.com/go-viper/mapstructure/v2 v2.4.0 // indirect
	github.com/goccy/go-json v0.10.5 // indirect
	github.com/gofrs/uuid v4.4.0+incompatible // indirect
	github.com/gogo/googleapis v1.4.1 // indirect
	github.com/gogo/status v1.1.1 // indirect
	github.com/golang-jwt/jwt/v5 v5.3.0 // indirect
	github.com/golang-sql/civil v0.0.0-20220223132316-b832511892a9 // indirect
	github.com/golang-sql/sqlexp v0.1.0 // indirect
	github.com/gomodule/redigo v1.8.9 // indirect
	github.com/google/btree v1.1.3 // indirect
	github.com/google/cel-go v0.26.1 // indirect
	github.com/google/flatbuffers v25.12.19+incompatible // indirect
	github.com/google/gnostic v0.7.1 // indirect
	github.com/google/gnostic-models v0.7.1 // indirect
	github.com/google/go-github/v73 v73.0.0 // indirect
	github.com/google/s2a-go v0.1.9 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.6 // indirect
	github.com/gophercloud/gophercloud/v2 v2.9.0 // indirect
	github.com/gopherjs/gopherjs v1.17.2 // indirect
	github.com/grafana/jsonparser v0.0.0-20240425183733-ea80629e1a32 // indirect
	github.com/grafana/regexp v0.0.0-20240518133315-a468a5bfb3bc // indirect
	github.com/grafana/sqlds/v5 v5.0.4 // indirect
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.1-0.20191002090509-6af20e3a5340 // indirect
	github.com/hashicorp/consul/api v1.31.2 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	github.com/hashicorp/go-immutable-radix v1.3.1 // indirect
	github.com/hashicorp/go-metrics v0.5.4 // indirect
	github.com/hashicorp/go-msgpack/v2 v2.1.2 // indirect
	github.com/hashicorp/go-retryablehttp v0.7.8 // indirect
	github.com/hashicorp/go-rootcerts v1.0.2 // indirect
	github.com/hashicorp/go-secure-stdlib/parseutil v0.2.0 // indirect
	github.com/hashicorp/go-secure-stdlib/plugincontainer v0.4.2 // indirect
	github.com/hashicorp/go-secure-stdlib/strutil v0.1.2 // indirect
	github.com/hashicorp/go-sockaddr v1.0.7 // indirect
	github.com/hashicorp/go-uuid v1.0.3 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/hashicorp/hcl v1.0.1-vault-7 // indirect
	github.com/hashicorp/memberlist v0.5.3 // indirect
	github.com/hashicorp/serf v0.10.2 // indirect
	github.com/hashicorp/vault/api v1.20.0 // indirect
	github.com/hashicorp/yamux v0.1.2 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/invopop/jsonschema v0.13.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/jaegertracing/jaeger v1.67.0 // indirect
	github.com/jaegertracing/jaeger-idl v0.6.0 // indirect
	github.com/jcmturner/aescts/v2 v2.0.0 // indirect
	github.com/jcmturner/dnsutils/v2 v2.0.0 // indirect
	github.com/jcmturner/gofork v1.7.6 // indirect
	github.com/jcmturner/goidentity/v6 v6.0.1 // indirect
	github.com/jcmturner/gokrb5/v8 v8.4.4 // indirect
	github.com/jcmturner/rpc/v2 v2.0.3 // indirect
	github.com/jessevdk/go-flags v1.6.1 // indirect
	github.com/jhump/protoreflect v1.17.0 // indirect
	github.com/jonboulle/clockwork v0.5.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/joshlf/go-acl v0.0.0-20200411065538-eae00ae38531 // indirect
	github.com/jpillora/backoff v1.0.0 // indirect
	github.com/jszwedko/go-datemath v0.1.1-0.20230526204004-640a500621d6 // indirect
	github.com/jtolds/gls v4.20.0+incompatible // indirect
	github.com/klauspost/asmfmt v1.3.2 // indirect
	github.com/klauspost/compress v1.18.4 // indirect
	github.com/klauspost/cpuid/v2 v2.3.0 // indirect
	github.com/kylelemons/godebug v1.1.0 // indirect
	github.com/lann/builder v0.0.0-20180802200727-47ae307949d0 // indirect
	github.com/lann/ps v0.0.0-20150810152359-62de8c46ede0 // indirect
	github.com/lestrrat-go/strftime v1.0.4 // indirect
	github.com/lufia/plan9stats v0.0.0-20240909124753-873cd0166683 // indirect
	github.com/magefile/mage v1.15.0 // indirect
	github.com/magiconair/properties v1.8.10 // indirect
	github.com/mailru/easyjson v0.9.1 // indirect
	github.com/matryer/is v1.4.1 // indirect
	github.com/mattbaird/jsonpatch v0.0.0-20240118010651-0ba75a80ca38 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/mattetti/filebuffer v1.0.1 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-ieproxy v0.0.12 // indirect
	github.com/mattn/go-runewidth v0.0.19 // indirect
	github.com/maypok86/otter v1.2.4 // indirect
	github.com/mdlayher/socket v0.4.1 // indirect
	github.com/mdlayher/vsock v1.2.1 // indirect
	github.com/mfridman/interpolate v0.0.2 // indirect
	github.com/miekg/dns v1.1.69 // indirect
	github.com/minio/asm2plan9s v0.0.0-20200509001527-cdd76441f9d8 // indirect
	github.com/minio/c2goasm v0.0.0-20190812172519-36a3d3bbc4f3 // indirect
	github.com/mitchellh/copystructure v1.2.0 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/mithrandie/csvq v1.18.1 // indirect
	github.com/mithrandie/csvq-driver v1.7.0 // indirect
	github.com/mithrandie/go-file/v2 v2.1.0 // indirect
	github.com/mithrandie/go-text v1.6.0 // indirect
	github.com/mithrandie/ternary v1.1.1 // indirect
	github.com/moby/docker-image-spec v1.3.1 // indirect
	github.com/moby/go-archive v0.1.0 // indirect
	github.com/moby/patternmatcher v0.6.0 // indirect
	github.com/moby/spdystream v0.5.0 // indirect
	github.com/moby/sys/sequential v0.6.0 // indirect
	github.com/moby/sys/user v0.4.0 // indirect
	github.com/moby/sys/userns v0.1.0 // indirect
	github.com/moby/term v0.5.0 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // indirect
	github.com/morikuni/aec v1.0.0 // indirect
	github.com/mschoch/smat v0.2.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/mxk/go-flowrate v0.0.0-20140419014527-cca7078d478f // indirect
	github.com/natefinch/wrap v0.2.0 // indirect
	github.com/ncruces/go-strftime v1.0.0 // indirect
	github.com/nikunjy/rules v1.5.0 // indirect
	github.com/oapi-codegen/runtime v1.0.0 // indirect
	github.com/oasdiff/yaml v0.0.0-20250309154309-f31be36b4037 // indirect
	github.com/oasdiff/yaml3 v0.0.0-20250309153720-d2182401db90 // indirect
	github.com/oklog/run v1.1.0 // indirect
	github.com/oklog/ulid v1.3.1 // indirect
	github.com/oklog/ulid/v2 v2.1.1 // indirect
	github.com/open-telemetry/opentelemetry-collector-contrib/internal/coreinternal v0.124.1 // indirect
	github.com/open-telemetry/opentelemetry-collector-contrib/pkg/core/xidutils v0.124.1 // indirect
	github.com/open-telemetry/opentelemetry-collector-contrib/pkg/translator/jaeger v0.124.1 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.1.1 // indirect
	github.com/opentracing-contrib/go-stdlib v1.1.0 // indirect
	github.com/pelletier/go-toml/v2 v2.2.4 // indirect
	github.com/perimeterx/marshmallow v1.1.5 // indirect
	github.com/pierrec/lz4/v4 v4.1.23 // indirect
	github.com/pires/go-proxyproto v0.8.1 // indirect
	github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/power-devops/perfstat v0.0.0-20240221224432-82ca36839d55 // indirect
	github.com/prometheus/common/sigv4 v0.1.0 // indirect
	github.com/prometheus/exporter-toolkit v0.15.1 // indirect
	github.com/prometheus/otlptranslator v1.0.0 // indirect
	github.com/prometheus/procfs v0.19.2 // indirect
	github.com/puzpuzpuz/xsync/v2 v2.5.1 // indirect
	github.com/quagmt/udecimal v1.9.0 // indirect
	github.com/redis/rueidis v1.0.68 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/ryanuber/go-glob v1.0.0 // indirect
	github.com/sagikazarmark/locafero v0.11.0 // indirect
	github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	github.com/segmentio/encoding v0.5.3 // indirect
	github.com/sercand/kuberesolver/v6 v6.0.1 // indirect
	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3 // indirect
	github.com/sethvargo/go-retry v0.3.0 // indirect
	github.com/shadowspore/fossil-delta v0.0.0-20241213113458-1d797d70cbe3 // indirect
	github.com/shirou/gopsutil/v4 v4.25.3 // indirect
	github.com/shurcooL/httpfs v0.0.0-20230704072500-f1e31cf0ba5c // indirect
	github.com/shurcooL/vfsgen v0.0.0-20230704071429-0000e147ea92 // indirect
	github.com/sirupsen/logrus v1.9.3 // indirect
	github.com/sony/gobreaker v0.5.0 // indirect
	github.com/sourcegraph/conc v0.3.1-0.20240121214520-5f936abd7ae8 // indirect
	github.com/spf13/afero v1.15.0 // indirect
	github.com/spf13/cast v1.10.0 // indirect
	github.com/spf13/viper v1.21.0 // indirect
	github.com/spiffe/go-spiffe/v2 v2.6.0 // indirect
	github.com/stoewer/go-strcase v1.3.1 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/subosito/gotenv v1.6.0 // indirect
	github.com/tklauser/go-sysconf v0.3.14 // indirect
	github.com/tklauser/numcpus v0.8.0 // indirect
	github.com/uber/jaeger-client-go v2.30.0+incompatible // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/unknwon/bra v0.0.0-20200517080246-1e3013ecaff8 // indirect
	github.com/unknwon/com v1.0.1 // indirect
	github.com/unknwon/log v0.0.0-20200308114134-929b1006e34a // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/wk8/go-ordered-map/v2 v2.1.8 // indirect
	github.com/woodsbury/decimal128 v1.4.0 // indirect
	github.com/x448/float16 v0.8.4 // indirect
	github.com/xrash/smetrics v0.0.0-20240521201337-686a1a2994c1 // indirect
	github.com/yudai/golcs v0.0.0-20170316035057-ecda9a501e82 // indirect
	github.com/yudai/pp v2.0.1+incompatible // indirect
	github.com/yuin/gopher-lua v1.1.1 // indirect
	github.com/yusufpapurcu/wmi v1.2.4 // indirect
	github.com/zclconf/go-cty v1.16.3 // indirect
	github.com/zeebo/xxh3 v1.0.2 // indirect
	go.etcd.io/etcd/api/v3 v3.6.7 // indirect
	go.etcd.io/etcd/client/pkg/v3 v3.6.7 // indirect
	go.etcd.io/etcd/client/v3 v3.6.7 // indirect
	go.mongodb.org/mongo-driver v1.17.6 // indirect
	go.opentelemetry.io/auto/sdk v1.2.1 // indirect
	go.opentelemetry.io/collector/featuregate v1.44.0 // indirect
	go.opentelemetry.io/collector/semconv v0.124.0 // indirect
	go.opentelemetry.io/contrib/bridges/prometheus v0.64.0 // indirect
	go.opentelemetry.io/contrib/detectors/gcp v1.39.0 // indirect
	go.opentelemetry.io/contrib/exporters/autoexport v0.64.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.15.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.39.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.39.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.40.0 // indirect
	go.opentelemetry.io/otel/exporters/prometheus v0.61.0 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdoutlog v0.15.0 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdoutmetric v1.39.0 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.39.0 // indirect
	go.opentelemetry.io/otel/metric v1.40.0 // indirect
	go.opentelemetry.io/otel/sdk/metric v1.40.0 // indirect
	go.yaml.in/yaml/v2 v2.4.3 // indirect
	go4.org/netipx v0.0.0-20230125063823-8449b0a6169f // indirect
	golang.org/x/crypto v0.48.0 // indirect
	golang.org/x/sys v0.41.0 // indirect
	golang.org/x/telemetry v0.0.0-20260209163413-e7419c687ee4 // indirect
	golang.org/x/term v0.40.0 // indirect
	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da // indirect
	gomodules.xyz/jsonpatch/v2 v2.5.0 // indirect
	google.golang.org/genproto v0.0.0-20250715232539-7130f93afb79 // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20260128011058-8636f8732409 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20260128011058-8636f8732409 // indirect
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/evanphx/json-patch.v4 v4.13.0 // indirect
	gopkg.in/fsnotify/fsnotify.v1 v1.4.7 // indirect
	gopkg.in/inf.v0 v0.9.1 // indirect
	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
	gopkg.in/src-d/go-errors.v1 v1.0.0 // indirect
	gopkg.in/telebot.v3 v3.3.8 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
	k8s.io/kms v0.35.1 // indirect
	modernc.org/libc v1.67.6 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.11.0 // indirect
	sigs.k8s.io/apiserver-network-proxy/konnectivity-client v0.34.0 // indirect
	sigs.k8s.io/json v0.0.0-20250730193827-2d320260d730 // indirect
	sigs.k8s.io/yaml v1.6.0 // indirect
	github.com/clipperhouse/displaywidth v0.6.2 // indirect
	github.com/clipperhouse/stringish v0.1.1 // indirect
	github.com/clipperhouse/uax29/v2 v2.3.0 // indirect
	github.com/olekukonko/cat v0.0.0-20250911104152-50322a0618f6 // indirect
	github.com/olekukonko/errors v1.1.0 // indirect
	github.com/olekukonko/ll v0.1.4-0.20260115111900-9e59c2286df0 // indirect
)

replace (
	// Use fork of crewjam/saml with fixes for some issues until changes get merged into upstream
	github.com/crewjam/saml => github.com/grafana/saml v0.4.15-0.20240917091248-ae3bbdad8a56

	// Use our fork of dolthub/go-mysql-server which makes non-cgo the default
	// since using a build tag is not sufficient for some use cases (e.g. developers tests in IDE).
	github.com/dolthub/go-mysql-server => github.com/grafana/go-mysql-server v0.20.1-grafana1

	// lock for mysql tsdb compat
	github.com/go-sql-driver/mysql => github.com/go-sql-driver/mysql v1.7.1

	// Pin gomemcache to avoid breaking changes in newer versions (see exclude section)
	github.com/grafana/gomemcache => github.com/grafana/gomemcache v0.0.0-20250318131618-74242eea118d

	// Use our fork of memberlist which includes some fixes that haven't been merged upstream yet.
	github.com/hashicorp/memberlist => github.com/grafana/memberlist v0.3.1-0.20251126142931-6f9f62ab6f86

	// Use our fork of the upstream Alertmanager.
	github.com/prometheus/alertmanager => github.com/grafana/prometheus-alertmanager v0.25.1-0.20260112162805-d29cc9cf7f0f

	// Pin OpenTelemetry log packages to v0.12.2 for compatibility with dagger v0.18.8
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc => go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.12.2
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp => go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.12.2
	go.opentelemetry.io/otel/exporters/stdout/stdoutlog => go.opentelemetry.io/otel/exporters/stdout/stdoutlog v0.12.2
	go.opentelemetry.io/otel/log => go.opentelemetry.io/otel/log v0.12.2
	go.opentelemetry.io/otel/sdk/log => go.opentelemetry.io/otel/sdk/log v0.12.2
)

exclude (
	// This package contains test data for github.com/RoaringBitmap/roaring, which is
	// only used to run tests and not required for building the Grafana binary.
	// Since the test data doesn't contain a license file we exclude it.
	github.com/RoaringBitmap/real-roaring-datasets v0.0.0-20190726190000-eb7c87156f76

	// gomemcache 20250828162811 contains breaking changes, so it needs to be excluded unless loki package is updated
	github.com/grafana/gomemcache v0.0.0-20250828162811-a96f6acee2fe
	github.com/mattn/go-sqlite3 v2.0.3+incompatible

	// v1.* versions were retracted, we need to stick with v0.*. This should work
	// without the exclude, but this otherwise gets pulled in as a transitive
	// dependency.
	github.com/prometheus/prometheus v1.8.2-0.20221021121301-51a44e6657c3

	// testcontainers-go v0.38.0 is not compatible with docker v28.5.2, so we need to exclude it
	github.com/testcontainers/testcontainers-go v0.38.0

	// This was retracted, but seems to be known by the Go module proxy, and is
	// otherwise pulled in as a transitive dependency.
	k8s.io/client-go v12.0.0+incompatible
)
