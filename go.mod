module github.com/grafana/grafana

go 1.24.5

require (
	buf.build/gen/go/parca-dev/parca/connectrpc/go v1.17.0-20240902100956-02fd72488966.1 // @grafana/observability-traces-and-profiling
	buf.build/gen/go/parca-dev/parca/protocolbuffers/go v1.34.2-20240902100956-02fd72488966.2 // @grafana/observability-traces-and-profiling
	cloud.google.com/go/kms v1.21.0 // @grafana/grafana-backend-group
	cloud.google.com/go/storage v1.52.0 // @grafana/grafana-backend-group
	connectrpc.com/connect v1.17.0 // @grafana/observability-traces-and-profiling
	cuelang.org/go v0.11.1 // @grafana/grafana-as-code
	filippo.io/age v1.2.1 // @grafana/identity-access-team
	github.com/Azure/azure-sdk-for-go v68.0.0+incompatible // @grafana/partner-datasources
	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.17.0 // @grafana/identity-access-team
	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.8.1 // @grafana/grafana-backend-group
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/azkeys v0.10.0 // @grafana/grafana-backend-group
	github.com/Azure/azure-storage-blob-go v0.15.0 // @grafana/grafana-backend-group
	github.com/Azure/go-autorest/autorest v0.11.29 // @grafana/grafana-backend-group
	github.com/Azure/go-autorest/autorest/adal v0.9.24 // @grafana/grafana-backend-group
	github.com/BurntSushi/toml v1.5.0 // @grafana/identity-access-team
	github.com/DATA-DOG/go-sqlmock v1.5.2 // @grafana/grafana-search-and-storage
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-group
	github.com/Masterminds/semver/v3 v3.3.1 // @grafana/grafana-developer-enablement-squad
	github.com/Masterminds/sprig/v3 v3.3.0 // @grafana/grafana-backend-group
	github.com/ProtonMail/go-crypto v1.1.6 // @grafana/plugins-platform-backend
	github.com/VividCortex/mysqlerr v0.0.0-20170204212430-6c6b55f8796f // @grafana/grafana-backend-group
	github.com/alicebob/miniredis/v2 v2.33.0 // @grafana/alerting-backend
	github.com/andybalholm/brotli v1.1.1 // @grafana/partner-datasources
	github.com/apache/arrow-go/v18 v18.0.1-0.20241212180703-82be143d7c30 // @grafana/plugins-platform-backend
	github.com/armon/go-radix v1.0.0 // @grafana/grafana-app-platform-squad
	github.com/aws/aws-sdk-go v1.55.7 // @grafana/aws-datasources
	github.com/beevik/etree v1.4.1 // @grafana/grafana-backend-group
	github.com/benbjohnson/clock v1.3.5 // @grafana/alerting-backend
	github.com/blang/semver/v4 v4.0.0 // indirect; @grafana/grafana-developer-enablement-squad
	github.com/blevesearch/bleve/v2 v2.5.0 // @grafana/grafana-search-and-storage
	github.com/blevesearch/bleve_index_api v1.2.7 // indirect; @grafana/grafana-search-and-storage
	github.com/blugelabs/bluge v0.2.2 // @grafana/grafana-backend-group
	github.com/blugelabs/bluge_segment_api v0.2.0 // @grafana/grafana-backend-group
	github.com/bradfitz/gomemcache v0.0.0-20230905024940-24af94b03874 // @grafana/grafana-backend-group
	github.com/bwmarrin/snowflake v0.3.0 // @grafan/grafana-app-platform-squad
	github.com/centrifugal/centrifuge v0.35.0 // @grafana/grafana-app-platform-squad
	github.com/crewjam/saml v0.4.14 // @grafana/identity-access-team
	github.com/dlmiddlecote/sqlstats v1.0.2 // @grafana/grafana-backend-group
	github.com/fatih/color v1.18.0 // @grafana/grafana-backend-group
	github.com/fullstorydev/grpchan v1.1.1 // @grafana/grafana-backend-group
	github.com/gchaincl/sqlhooks v1.3.0 // @grafana/grafana-search-and-storage
	github.com/getkin/kin-openapi v0.132.0 // @grafana/grafana-app-platform-squad
	github.com/go-jose/go-jose/v3 v3.0.4 // @grafana/identity-access-team
	github.com/go-kit/log v0.2.1 //  @grafana/grafana-backend-group
	github.com/go-ldap/ldap/v3 v3.4.4 // @grafana/identity-access-team
	github.com/go-openapi/loads v0.22.0 // @grafana/alerting-backend
	github.com/go-openapi/runtime v0.28.0 // @grafana/alerting-backend
	github.com/go-openapi/strfmt v0.23.0 // @grafana/alerting-backend
	github.com/go-redis/redis/v8 v8.11.5 // @grafana/grafana-backend-group
	github.com/go-sourcemap/sourcemap v2.1.4+incompatible // @grafana/grafana-backend-group
	github.com/go-sql-driver/mysql v1.9.2 // @grafana/grafana-search-and-storage
	github.com/go-stack/stack v1.8.1 // @grafana/grafana-backend-group
	github.com/gobwas/glob v0.2.3 // @grafana/grafana-backend-group
	github.com/gogo/protobuf v1.3.2 // @grafana/alerting-backend
	github.com/golang-jwt/jwt/v4 v4.5.2 // @grafana/grafana-backend-group
	github.com/golang-migrate/migrate/v4 v4.7.0 // @grafana/grafana-backend-group
	github.com/golang/mock v1.7.0-rc.1 // @grafana/alerting-backend
	github.com/golang/protobuf v1.5.4 // @grafana/grafana-backend-group
	github.com/golang/snappy v0.0.4 // @grafana/alerting-backend
	github.com/google/go-cmp v0.7.0 // @grafana/grafana-backend-group
	github.com/google/go-querystring v1.1.0 // indirect; @grafana/oss-big-tent
	github.com/google/uuid v1.6.0 // @grafana/grafana-backend-group
	github.com/google/wire v0.6.0 // @grafana/grafana-backend-group
	github.com/googleapis/gax-go/v2 v2.14.1 // @grafana/grafana-backend-group
	github.com/gorilla/mux v1.8.1 // @grafana/grafana-backend-group
	github.com/gorilla/websocket v1.5.3 // @grafana/grafana-app-platform-squad
	github.com/grafana/alerting v0.0.0-20250725130805-615c8286e14b // @grafana/alerting-backend
	github.com/grafana/authlib v0.0.0-20250721184729-1593a38e4933 // @grafana/identity-access-team
	github.com/grafana/authlib/types v0.0.0-20250314102521-a77865c746c0 // indirect; @grafana/identity-access-team
	github.com/grafana/dataplane/examples v0.0.1 // @grafana/observability-metrics
	github.com/grafana/dataplane/sdata v0.0.9 // @grafana/observability-metrics
	github.com/grafana/dskit v0.0.0-20250611075409-46f51e1ce914 // @grafana/grafana-backend-group
	github.com/grafana/e2e v0.1.1 // @grafana-app-platform-squad
	github.com/grafana/gofpdf v0.0.0-20250307124105-3b9c5d35577f // @grafana/sharing-squad
	github.com/grafana/gomemcache v0.0.0-20250318131618-74242eea118d // @grafana/grafana-operator-experience-squad
	github.com/grafana/grafana-app-sdk v0.31.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana-app-sdk/logging v0.30.0 // indirect; @grafana/grafana-app-platform-squad
	github.com/grafana/grafana-aws-sdk v0.31.5 // @grafana/aws-datasources
	github.com/grafana/grafana-azure-sdk-go/v2 v2.1.6 // @grafana/partner-datasources
	github.com/grafana/grafana-cloud-migration-snapshot v1.6.0 // @grafana/grafana-operator-experience-squad
	github.com/grafana/grafana-google-sdk-go v0.2.1 // @grafana/partner-datasources
	github.com/grafana/grafana-openapi-client-go v0.0.0-20231213163343-bd475d63fb79 // @grafana/grafana-backend-group
	github.com/grafana/grafana-plugin-sdk-go v0.267.0 // @grafana/plugins-platform-backend
	github.com/grafana/loki/v3 v3.2.1 // @grafana/observability-logs
	github.com/grafana/otel-profiling-go v0.5.1 // @grafana/grafana-backend-group
	github.com/grafana/pyroscope-go/godeltaprof v0.1.8 // @grafana/observability-traces-and-profiling
	github.com/grafana/pyroscope/api v1.0.0 // @grafana/observability-traces-and-profiling
	github.com/grafana/tempo v1.5.1-0.20241001135150-ed943d7a56b2 // @grafana/observability-traces-and-profiling
	github.com/grpc-ecosystem/go-grpc-middleware/providers/prometheus v1.0.1 // @grafana/plugins-platform-backend
	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.3.2 // @grafana/grafana-backend-group
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.26.3 // @grafana/identity-access-team
	github.com/hashicorp/go-hclog v1.6.3 // @grafana/plugins-platform-backend
	github.com/hashicorp/go-multierror v1.1.1 // @grafana/alerting-squad
	github.com/hashicorp/go-plugin v1.6.3 // @grafana/plugins-platform-backend
	github.com/hashicorp/go-version v1.7.0 // @grafana/grafana-backend-group
	github.com/hashicorp/golang-lru/v2 v2.0.7 // @grafana/alerting-backend
	github.com/hashicorp/hcl/v2 v2.17.0 // @grafana/alerting-backend
	github.com/huandu/xstrings v1.5.0 // @grafana/partner-datasources
	github.com/influxdata/influxdb-client-go/v2 v2.13.0 // @grafana/partner-datasources
	github.com/influxdata/influxql v1.4.0 // @grafana/partner-datasources
	github.com/influxdata/line-protocol v0.0.0-20210922203350-b1ad95c89adf // @grafana/grafana-app-platform-squad
	github.com/jmespath-community/go-jmespath v1.1.1 // @grafana/identity-access-team
	github.com/jmespath/go-jmespath v0.4.0 // indirect; // @grafana/grafana-backend-group
	github.com/jmoiron/sqlx v1.3.5 // @grafana/grafana-backend-group
	github.com/json-iterator/go v1.1.12 // @grafana/grafana-backend-group
	github.com/lib/pq v1.10.9 // @grafana/grafana-backend-group
	github.com/m3db/prometheus_remote_client_golang v0.4.4 // @grafana/grafana-backend-group
	github.com/madflojo/testcerts v1.1.1 // @grafana/alerting-backend
	github.com/magefile/mage v1.15.0 // indirect; @grafana/grafana-developer-enablement-squad
	github.com/mattn/go-isatty v0.0.20 // @grafana/grafana-backend-group
	github.com/mattn/go-sqlite3 v1.14.22 // @grafana/grafana-backend-group
	github.com/matttproud/golang_protobuf_extensions v1.0.4 // @grafana/alerting-backend
	github.com/microsoft/go-mssqldb v1.8.0 // @grafana/partner-datasources
	github.com/mitchellh/mapstructure v1.5.1-0.20231216201459-8508981c8b6c //@grafana/identity-access-team
	github.com/mocktools/go-smtp-mock/v2 v2.3.1 // @grafana/grafana-backend-group
	github.com/modern-go/reflect2 v1.0.2 // @grafana/alerting-backend
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // @grafana/alerting-backend
	github.com/mwitkow/go-conntrack v0.0.0-20190716064945-2f068394615f // @grafana/grafana-operator-experience-squad
	github.com/olekukonko/tablewriter v0.0.5 // @grafana/grafana-backend-group
	github.com/openfga/api/proto v0.0.0-20250127102726-f9709139a369 // @grafana/identity-access-team
	github.com/openfga/language/pkg/go v0.2.0-beta.2.0.20250220223040-ed0cfba54336 // @grafana/identity-access-team
	github.com/openfga/openfga v1.8.13 // @grafana/identity-access-team
	github.com/openzipkin/zipkin-go v0.4.3 // @grafana/oss-big-tent
	github.com/patrickmn/go-cache v2.1.0+incompatible // @grafana/alerting-backend
	github.com/phpdave11/gofpdi v1.0.14 // @grafana/sharing-squad
	github.com/prometheus/alertmanager v0.27.0 // @grafana/alerting-backend
	github.com/prometheus/client_golang v1.22.0 // @grafana/alerting-backend
	github.com/prometheus/client_model v0.6.2 // @grafana/grafana-backend-group
	github.com/prometheus/common v0.64.0 // @grafana/alerting-backend
	github.com/prometheus/prometheus v0.301.0 // @grafana/alerting-backend
	github.com/redis/go-redis/v9 v9.7.3 // @grafana/alerting-backend
	github.com/robfig/cron/v3 v3.0.1 // @grafana/grafana-backend-group
	github.com/rs/cors v1.11.1 // @grafana/identity-access-team
	github.com/russellhaering/goxmldsig v1.4.0 // @grafana/grafana-backend-group
	github.com/spf13/cobra v1.9.1 // @grafana/grafana-app-platform-squad
	github.com/spf13/pflag v1.0.6 // @grafana-app-platform-squad
	github.com/spyzhov/ajson v0.9.0 // @grafana/grafana-app-platform-squad
	github.com/stretchr/testify v1.10.0 // @grafana/grafana-backend-group
	github.com/teris-io/shortid v0.0.0-20171029131806-771a37caa5cf // @grafana/grafana-backend-group
	github.com/ua-parser/uap-go v0.0.0-20250213224047-9c035f085b90 // @grafana/grafana-backend-group
	github.com/urfave/cli v1.22.16 // indirect; @grafana/grafana-backend-group
	github.com/urfave/cli/v2 v2.27.6 // @grafana/grafana-backend-group
	github.com/wk8/go-ordered-map v1.0.0 // @grafana/grafana-backend-group
	github.com/xlab/treeprint v1.2.0 // @grafana/observability-traces-and-profiling
	github.com/youmark/pkcs8 v0.0.0-20181117223130-1be2e3e5546d // @grafana/grafana-operator-experience-squad
	github.com/yudai/gojsondiff v1.0.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/collector/pdata v1.22.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.60.0 // @grafana/plugins-platform-backend
	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.60.0 // @grafana/grafana-operator-experience-squad
	go.opentelemetry.io/contrib/propagators/jaeger v1.35.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/contrib/samplers/jaegerremote v0.30.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel v1.36.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/jaeger v1.17.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.36.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.36.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/sdk v1.36.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/trace v1.36.0 // @grafana/grafana-backend-group
	go.uber.org/atomic v1.11.0 // @grafana/alerting-backend
	go.uber.org/goleak v1.3.0 // @grafana/grafana-search-and-storage
	go.uber.org/zap v1.27.0 // @grafana/identity-access-team
	gocloud.dev v0.40.0 // @grafana/grafana-app-platform-squad
	golang.org/x/crypto v0.39.0 // @grafana/grafana-backend-group
	golang.org/x/exp v0.0.0-20250506013437-ce4c2cf36ca6 // @grafana/alerting-backend
	golang.org/x/mod v0.25.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/net v0.41.0 // @grafana/oss-big-tent @grafana/partner-datasources
	golang.org/x/oauth2 v0.30.0 // @grafana/identity-access-team
	golang.org/x/sync v0.15.0 // @grafana/alerting-backend
	golang.org/x/text v0.26.0 // @grafana/grafana-backend-group
	golang.org/x/time v0.11.0 // @grafana/grafana-backend-group
	golang.org/x/tools v0.34.0 // indirect; @grafana/grafana-as-code
	gonum.org/v1/gonum v0.15.1 // @grafana/oss-big-tent
	google.golang.org/api v0.233.0 // @grafana/grafana-backend-group
	google.golang.org/grpc v1.73.0 // @grafana/plugins-platform-backend
	google.golang.org/protobuf v1.36.6 // @grafana/plugins-platform-backend
	gopkg.in/ini.v1 v1.67.0 // @grafana/alerting-backend
	gopkg.in/mail.v2 v2.3.1 // @grafana/grafana-backend-group
	gopkg.in/yaml.v3 v3.0.1 // @grafana/alerting-backend
	k8s.io/api v0.32.1 // @grafana/grafana-app-platform-squad
	k8s.io/apimachinery v0.32.1 // @grafana/grafana-app-platform-squad
	k8s.io/apiserver v0.32.1 // @grafana/grafana-app-platform-squad
	k8s.io/client-go v0.32.1 // @grafana/grafana-app-platform-squad
	k8s.io/component-base v0.32.1 // @grafana/grafana-app-platform-squad
	k8s.io/klog/v2 v2.130.1 // @grafana/grafana-app-platform-squad
	k8s.io/kube-aggregator v0.32.0 // @grafana/grafana-app-platform-squad
	k8s.io/kube-openapi v0.0.0-20241105132330-32ad38e42d3f // @grafana/grafana-app-platform-squad
	k8s.io/utils v0.0.0-20241104100929-3ea5e8cea738 // @grafana/partner-datasources
	sigs.k8s.io/structured-merge-diff/v4 v4.5.0 // @grafana-app-platform-squad
	// xorm dependencies: We use modern xorm.io/* paths, but some transitive dependencies
	// still import legacy github.com/go-xorm/* paths, causing harmless module path warnings.
	// This is safe to ignore - backend compilation works correctly.
	xorm.io/builder v0.3.6 // @grafana/grafana-backend-group
	xorm.io/core v0.7.3 // @grafana/grafana-backend-group
	xorm.io/xorm v0.8.2 // @grafana/alerting-backend
)

require (
	github.com/grafana/grafana/apps/alerting/notifications v0.0.0-20250220163425-b4c4b9abbdc8 // @grafana/alerting-backend
	github.com/grafana/grafana/apps/playlist v0.0.0-20250220164708-c8d4ff28a450 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/aggregator v0.0.0-20250220163425-b4c4b9abbdc8 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/apimachinery v0.0.0-20250220154326-6e5de80ef295 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/apiserver v0.0.0-20250220154326-6e5de80ef295 // @grafana/grafana-app-platform-squad

	// This needs to be here for other projects that import grafana/grafana
	// For local development grafana/grafana will always use the local files
	// Check go.work file for details
	github.com/grafana/grafana/pkg/promlib v0.0.8 // @grafana/oss-big-tent
	github.com/grafana/grafana/pkg/semconv v0.0.0-20250220164708-c8d4ff28a450 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/storage/unified/apistore v0.0.0-20250220154326-6e5de80ef295 // @grafana/grafana-search-and-storage
	github.com/grafana/grafana/pkg/storage/unified/resource v0.0.0-20250220154326-6e5de80ef295 // @grafana/grafana-search-and-storage
)

require (
	cel.dev/expr v0.23.1 // indirect
	cloud.google.com/go v0.120.0 // indirect
	cloud.google.com/go/auth v0.16.1 // indirect
	cloud.google.com/go/auth/oauth2adapt v0.2.8 // indirect
	cloud.google.com/go/compute/metadata v0.6.0 // indirect
	cloud.google.com/go/iam v1.5.0 // indirect
	cloud.google.com/go/longrunning v0.6.6 // indirect
	cloud.google.com/go/monitoring v1.24.0 // indirect
	cuelabs.dev/go/oci/ociregistry v0.0.0-20240906074133-82eb438dd565 // indirect
	dario.cat/mergo v1.0.1 // indirect
	github.com/Azure/azure-pipeline-go v0.2.3 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/internal v1.10.0 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/internal v0.7.1 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/storage/azblob v1.3.2 // indirect
	github.com/Azure/go-autorest v14.2.0+incompatible // indirect
	github.com/Azure/go-autorest/autorest/date v0.3.0 // indirect
	github.com/Azure/go-autorest/autorest/to v0.4.0 // indirect
	github.com/Azure/go-autorest/autorest/validation v0.3.1 // indirect
	github.com/Azure/go-autorest/logger v0.2.1 // indirect
	github.com/Azure/go-autorest/tracing v0.6.0 // indirect
	github.com/Azure/go-ntlmssp v0.0.0-20220621081337-cb9428e4ac1e // indirect
	github.com/AzureAD/microsoft-authentication-library-for-go v1.3.2 // indirect
	github.com/FZambia/eagle v0.2.0 // indirect
	github.com/GoogleCloudPlatform/opentelemetry-operations-go/detectors/gcp v1.27.0 // indirect
	github.com/HdrHistogram/hdrhistogram-go v1.1.2 // indirect
	github.com/Masterminds/goutils v1.1.1 // indirect
	github.com/Masterminds/squirrel v1.5.4 // indirect
	github.com/NYTimes/gziphandler v1.1.1 // indirect
	github.com/RoaringBitmap/roaring v1.9.3 // indirect
	github.com/Yiling-J/theine-go v0.6.1 // indirect
	github.com/agext/levenshtein v1.2.1 // indirect
	github.com/alecthomas/units v0.0.0-20240927000941-0f3dac36c52b // indirect
	github.com/alicebob/gopher-json v0.0.0-20200520072559-a9ecdc9d1d3a // indirect
	github.com/antlr4-go/antlr/v4 v4.13.1 // indirect
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/apparentlymart/go-textseg/v13 v13.0.0 // indirect
	github.com/armon/go-metrics v0.4.1 // indirect
	github.com/asaskevich/govalidator v0.0.0-20230301143203-a9d515a09cc2 // indirect
	github.com/at-wat/mqtt-go v0.19.4 // indirect
	github.com/aws/aws-sdk-go-v2 v1.30.3 // indirect
	github.com/aws/aws-sdk-go-v2/aws/protocol/eventstream v1.6.3 // indirect
	github.com/aws/aws-sdk-go-v2/config v1.27.27 // indirect
	github.com/aws/aws-sdk-go-v2/credentials v1.17.27 // indirect
	github.com/aws/aws-sdk-go-v2/feature/ec2/imds v1.16.11 // indirect
	github.com/aws/aws-sdk-go-v2/feature/s3/manager v1.17.10 // indirect
	github.com/aws/aws-sdk-go-v2/internal/configsources v1.3.15 // indirect
	github.com/aws/aws-sdk-go-v2/internal/endpoints/v2 v2.6.15 // indirect
	github.com/aws/aws-sdk-go-v2/internal/ini v1.8.0 // indirect
	github.com/aws/aws-sdk-go-v2/internal/v4a v1.3.15 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/accept-encoding v1.11.3 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/checksum v1.3.17 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/presigned-url v1.11.17 // indirect
	github.com/aws/aws-sdk-go-v2/service/internal/s3shared v1.17.15 // indirect
	github.com/aws/aws-sdk-go-v2/service/s3 v1.58.3 // indirect
	github.com/aws/aws-sdk-go-v2/service/sso v1.22.4 // indirect
	github.com/aws/aws-sdk-go-v2/service/ssooidc v1.26.4 // indirect
	github.com/aws/aws-sdk-go-v2/service/sts v1.30.3 // indirect
	github.com/aws/smithy-go v1.20.3 // indirect
	github.com/axiomhq/hyperloglog v0.0.0-20240507144631-af9851f82b27 // indirect
	github.com/bahlo/generic-list-go v0.2.0 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/bits-and-blooms/bitset v1.22.0 // indirect
	github.com/blevesearch/geo v0.1.20 // indirect
	github.com/blevesearch/go-faiss v1.0.25 // indirect
	github.com/blevesearch/go-porterstemmer v1.0.3 // indirect
	github.com/blevesearch/gtreap v0.1.1 // indirect
	github.com/blevesearch/mmap-go v1.0.4 // indirect
	github.com/blevesearch/scorch_segment_api/v2 v2.3.9 // indirect
	github.com/blevesearch/segment v0.9.1 // indirect
	github.com/blevesearch/snowballstem v0.9.0 // indirect
	github.com/blevesearch/upsidedown_store_api v1.0.2 // indirect
	github.com/blevesearch/vellum v1.1.0 // indirect
	github.com/blevesearch/zapx/v11 v11.4.1 // indirect
	github.com/blevesearch/zapx/v12 v12.4.1 // indirect
	github.com/blevesearch/zapx/v13 v13.4.1 // indirect
	github.com/blevesearch/zapx/v14 v14.4.1 // indirect
	github.com/blevesearch/zapx/v15 v15.4.1 // indirect
	github.com/blevesearch/zapx/v16 v16.2.2 // indirect
	github.com/blugelabs/ice v1.0.0 // indirect
	github.com/blugelabs/ice/v2 v2.0.1 // indirect
	github.com/bufbuild/protocompile v0.4.0 // indirect
	github.com/buger/jsonparser v1.1.1 // indirect
	github.com/c2h5oh/datasize v0.0.0-20231215233829-aa82cc1e6500 // indirect
	github.com/caio/go-tdigest v3.1.0+incompatible // indirect
	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
	github.com/centrifugal/protocol v0.16.0 // indirect
	github.com/cespare/xxhash v1.1.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/cheekybits/genny v1.0.0 // indirect
	github.com/chromedp/cdproto v0.0.0-20240810084448-b931b754e476 // indirect
	github.com/cloudflare/circl v1.3.7 // indirect
	github.com/cncf/xds/go v0.0.0-20250326154945-ae57f3c0d45f // indirect
	github.com/cockroachdb/apd/v3 v3.2.1 // indirect
	github.com/coreos/go-semver v0.3.1 // indirect
	github.com/coreos/go-systemd/v22 v22.5.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.6 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dennwc/varint v1.0.0 // indirect
	github.com/dgryski/go-metro v0.0.0-20180109044635-280f6062b5bc // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/dolthub/maphash v0.1.0 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/edsrzf/mmap-go v1.2.0 // indirect
	github.com/elazarl/goproxy v1.7.1 // indirect
	github.com/emicklei/go-restful/v3 v3.11.0 // indirect
	github.com/emicklei/proto v1.13.2 // indirect
	github.com/emirpasic/gods v1.18.1 // indirect
	github.com/envoyproxy/protoc-gen-validate v1.2.1 // indirect
	github.com/facette/natsort v0.0.0-20181210072756-2cd4dd1e2dcb // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/fsnotify/fsnotify v1.8.0 // indirect
	github.com/fxamacker/cbor/v2 v2.7.0 // indirect
	github.com/gammazero/deque v0.2.1 // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.4 // indirect
	github.com/go-logfmt/logfmt v0.6.0 // indirect
	github.com/go-logr/logr v1.4.2 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-openapi/analysis v0.23.0 // indirect
	github.com/go-openapi/errors v0.22.0 // indirect
	github.com/go-openapi/jsonpointer v0.21.0 // indirect
	github.com/go-openapi/jsonreference v0.21.0 // indirect
	github.com/go-openapi/spec v0.21.0 // indirect
	github.com/go-openapi/swag v0.23.0 // indirect
	github.com/go-openapi/validate v0.24.0 // indirect
	github.com/goccy/go-json v0.10.4 // indirect
	github.com/gofrs/uuid v4.4.0+incompatible // indirect
	github.com/gogo/googleapis v1.4.1 // indirect
	github.com/gogo/status v1.1.1 // indirect
	github.com/golang-jwt/jwt/v5 v5.2.2 // indirect
	github.com/golang-sql/civil v0.0.0-20220223132316-b832511892a9 // indirect
	github.com/golang-sql/sqlexp v0.1.0 // indirect
	github.com/golang/geo v0.0.0-20210211234256-740aa86cb551 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/google/btree v1.1.3 // indirect
	github.com/google/cel-go v0.25.0 // indirect
	github.com/google/flatbuffers v24.3.25+incompatible // indirect
	github.com/google/gnostic-models v0.6.8 // indirect
	github.com/google/gofuzz v1.2.0 // indirect
	github.com/google/s2a-go v0.1.9 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.6 // indirect
	github.com/grafana/jsonparser v0.0.0-20240425183733-ea80629e1a32 // indirect
	github.com/grafana/loki/pkg/push v0.0.0-20231124142027-e52380921608 // indirect
	github.com/grafana/regexp v0.0.0-20240518133315-a468a5bfb3bc // indirect
	github.com/grafana/sqlds/v4 v4.1.3 // indirect
	github.com/grpc-ecosystem/go-grpc-middleware v1.4.0 // indirect; @grafana/grafana-search-and-storage
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.1-0.20191002090509-6af20e3a5340 // indirect
	github.com/hashicorp/consul/api v1.30.0 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	github.com/hashicorp/go-immutable-radix v1.3.1 // indirect
	github.com/hashicorp/go-rootcerts v1.0.2 // indirect
	github.com/hashicorp/go-sockaddr v1.0.6 // indirect
	github.com/hashicorp/go-uuid v1.0.3 // indirect
	github.com/hashicorp/golang-lru v1.0.2 // indirect
	github.com/hashicorp/memberlist v0.5.2 // indirect
	github.com/hashicorp/serf v0.10.2 // indirect
	github.com/hashicorp/yamux v0.1.1 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/invopop/jsonschema v0.13.0 // indirect
	github.com/jackc/pgpassfile v1.0.0 // indirect
	github.com/jackc/pgservicefile v0.0.0-20240606120523-5a60cdf6a761 // indirect
	github.com/jackc/pgx/v5 v5.7.5 // indirect
	github.com/jackc/puddle/v2 v2.2.2 // indirect
	github.com/jcmturner/aescts/v2 v2.0.0 // indirect
	github.com/jcmturner/dnsutils/v2 v2.0.0 // indirect
	github.com/jcmturner/gofork v1.7.6 // indirect
	github.com/jcmturner/goidentity/v6 v6.0.1 // indirect
	github.com/jcmturner/gokrb5/v8 v8.4.4 // indirect
	github.com/jcmturner/rpc/v2 v2.0.3 // indirect
	github.com/jessevdk/go-flags v1.5.0 // indirect
	github.com/jhump/protoreflect v1.15.1 // indirect
	github.com/jonboulle/clockwork v0.5.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/jpillora/backoff v1.0.0 // indirect
	github.com/jszwedko/go-datemath v0.1.1-0.20230526204004-640a500621d6 // indirect
	github.com/jtolds/gls v4.20.0+incompatible // indirect
	github.com/klauspost/compress v1.18.0 // indirect
	github.com/klauspost/cpuid/v2 v2.2.9 // indirect
	github.com/kylelemons/godebug v1.1.0 // indirect
	github.com/lann/builder v0.0.0-20180802200727-47ae307949d0 // indirect
	github.com/lann/ps v0.0.0-20150810152359-62de8c46ede0 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattbaird/jsonpatch v0.0.0-20240118010651-0ba75a80ca38 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/mattetti/filebuffer v1.0.1 // indirect
	github.com/mattn/go-colorable v0.1.14 // indirect
	github.com/mattn/go-ieproxy v0.0.12 // indirect
	github.com/mattn/go-runewidth v0.0.16 // indirect
	github.com/maypok86/otter v1.2.4 // indirect
	github.com/mdlayher/socket v0.4.1 // indirect
	github.com/mdlayher/vsock v1.2.1 // indirect
	github.com/mfridman/interpolate v0.0.2 // indirect
	github.com/miekg/dns v1.1.63 // indirect
	github.com/mitchellh/copystructure v1.2.0 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/mithrandie/csvq v1.18.1 // indirect
	github.com/mithrandie/csvq-driver v1.7.0 // indirect
	github.com/mithrandie/go-file/v2 v2.1.0 // indirect
	github.com/mithrandie/go-text v1.6.0 // indirect
	github.com/mithrandie/ternary v1.1.1 // indirect
	github.com/moby/spdystream v0.5.0 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/mschoch/smat v0.2.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/mxk/go-flowrate v0.0.0-20140419014527-cca7078d478f // indirect
	github.com/natefinch/wrap v0.2.0 // indirect
	github.com/ncruces/go-strftime v0.1.9 // indirect
	github.com/oapi-codegen/runtime v1.0.0 // indirect
	github.com/oasdiff/yaml v0.0.0-20250309154309-f31be36b4037 // indirect
	github.com/oasdiff/yaml3 v0.0.0-20250309153720-d2182401db90 // indirect
	github.com/oklog/run v1.1.0 // indirect
	github.com/oklog/ulid v1.3.1 // indirect
	github.com/oklog/ulid/v2 v2.1.0 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.1.0 // indirect
	github.com/opentracing-contrib/go-grpc v0.0.0-20210225150812-73cb765af46e // indirect; @grafana/grafana-search-and-storage
	github.com/opentracing-contrib/go-stdlib v1.0.0 // indirect
	github.com/opentracing/opentracing-go v1.2.0 // indirect; @grafana/grafana-search-and-storage
	github.com/pelletier/go-toml/v2 v2.2.3 // indirect
	github.com/perimeterx/marshmallow v1.1.5 // indirect
	github.com/pierrec/lz4/v4 v4.1.22 // indirect
	github.com/pires/go-proxyproto v0.7.0 // indirect
	github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/planetscale/vtprotobuf v0.6.1-0.20240319094008-0393e58bdf10 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/pressly/goose/v3 v3.24.3 // indirect
	github.com/prometheus/common/sigv4 v0.1.0 // indirect
	github.com/prometheus/exporter-toolkit v0.13.2 // indirect
	github.com/prometheus/procfs v0.16.1 // indirect
	github.com/prometheus/sigv4 v0.1.0 // indirect
	github.com/protocolbuffers/txtpbfmt v0.0.0-20241112170944-20d2c9ebc01d // indirect
	github.com/puzpuzpuz/xsync/v2 v2.5.1 // indirect
	github.com/redis/rueidis v1.0.56 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/rogpeppe/go-internal v1.14.1 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/sagikazarmark/locafero v0.7.0 // indirect
	github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	github.com/segmentio/encoding v0.4.1 // indirect
	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3 // indirect
	github.com/sethvargo/go-retry v0.3.0 // indirect
	github.com/shadowspore/fossil-delta v0.0.0-20241213113458-1d797d70cbe3 // indirect
	github.com/shopspring/decimal v1.4.0 // indirect; @grafana/grafana-datasources-core-services
	github.com/shurcooL/httpfs v0.0.0-20230704072500-f1e31cf0ba5c // indirect
	github.com/shurcooL/vfsgen v0.0.0-20200824052919-0d455de96546 // indirect
	github.com/sony/gobreaker v0.5.0 // indirect
	github.com/sourcegraph/conc v0.3.0 // indirect
	github.com/spf13/afero v1.12.0 // indirect
	github.com/spf13/cast v1.7.1 // indirect
	github.com/spf13/viper v1.20.1 // indirect
	github.com/stoewer/go-strcase v1.3.0 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/subosito/gotenv v1.6.0 // indirect
	github.com/uber/jaeger-client-go v2.30.0+incompatible // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/unknwon/bra v0.0.0-20200517080246-1e3013ecaff8 // indirect
	github.com/unknwon/com v1.0.1 // indirect
	github.com/unknwon/log v0.0.0-20200308114134-929b1006e34a // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/wk8/go-ordered-map/v2 v2.1.8 // indirect
	github.com/x448/float16 v0.8.4 // indirect
	github.com/xrash/smetrics v0.0.0-20240521201337-686a1a2994c1 // indirect
	github.com/yudai/golcs v0.0.0-20170316035057-ecda9a501e82 // indirect
	github.com/yudai/pp v2.0.1+incompatible // indirect
	github.com/yuin/gopher-lua v1.1.1 // indirect
	github.com/zclconf/go-cty v1.13.0 // indirect
	github.com/zeebo/xxh3 v1.0.2 // indirect
	go.etcd.io/bbolt v1.4.0 // indirect
	go.etcd.io/etcd/api/v3 v3.5.16 // indirect
	go.etcd.io/etcd/client/pkg/v3 v3.5.16 // indirect
	go.etcd.io/etcd/client/v3 v3.5.16 // indirect
	go.mongodb.org/mongo-driver v1.16.1 // indirect
	go.opencensus.io v0.24.0 // indirect; @grafana/grafana-backend-group
	go.opentelemetry.io/auto/sdk v1.1.0 // indirect
	go.opentelemetry.io/contrib/detectors/gcp v1.35.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.61.0 // indirect; @grafana/sharing-squad
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp v1.36.0 // indirect
	go.opentelemetry.io/otel/metric v1.36.0 // indirect
	go.opentelemetry.io/otel/sdk/metric v1.36.0 // indirect
	go.opentelemetry.io/proto/otlp v1.6.0 // indirect
	go.uber.org/mock v0.5.2 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go4.org/netipx v0.0.0-20230125063823-8449b0a6169f // indirect
	golang.org/x/sys v0.33.0 // indirect
	golang.org/x/term v0.32.0 // indirect
	golang.org/x/xerrors v0.0.0-20240903120638-7835f813f4da // indirect
	gomodules.xyz/jsonpatch/v2 v2.4.0 // indirect
	google.golang.org/genproto v0.0.0-20250303144028-a0af3efb3deb // indirect
	google.golang.org/genproto/googleapis/api v0.0.0-20250519155744-55703ea1f237 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20250519155744-55703ea1f237 // indirect
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/evanphx/json-patch.v4 v4.12.0 // indirect
	gopkg.in/fsnotify/fsnotify.v1 v1.4.7 // indirect
	gopkg.in/inf.v0 v0.9.1 // indirect
	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	k8s.io/apiextensions-apiserver v0.32.1 // indirect
	k8s.io/kms v0.32.1 // indirect
	modernc.org/libc v1.65.0 // indirect
	modernc.org/mathutil v1.7.1 // indirect
	modernc.org/memory v1.10.0 // indirect
	modernc.org/sqlite v1.37.0 // indirect
	sigs.k8s.io/apiserver-network-proxy/konnectivity-client v0.31.0 // indirect
	sigs.k8s.io/json v0.0.0-20241010143419-9aa6b5e7a4b3 // indirect
	sigs.k8s.io/yaml v1.4.0 // indirect
)

require github.com/urfave/cli/v3 v3.3.8 // @grafana/grafana-backend-group

require (
	github.com/grafana/authlib/claims v0.0.0-20241202085737-df90af04f335
	github.com/grafana/grafana/apps/investigation v0.0.0-20250217164911-78ef9fd9d9ab
	github.com/jeremywohl/flatten v1.0.1
	github.com/linkedin/goavro/v2 v2.14.0
)

require (
	github.com/GoogleCloudPlatform/opentelemetry-operations-go/exporter/metric v0.51.0 // indirect
	github.com/GoogleCloudPlatform/opentelemetry-operations-go/internal/resourcemapping v0.51.0 // indirect
	github.com/RoaringBitmap/roaring/v2 v2.4.5 // indirect
	github.com/cenkalti/backoff/v5 v5.0.2 // indirect
	github.com/envoyproxy/go-control-plane/envoy v1.32.4 // indirect
	github.com/go-jose/go-jose/v4 v4.1.0 // indirect
	github.com/go-viper/mapstructure/v2 v2.3.0 // indirect
	github.com/hashicorp/go-metrics v0.5.4 // indirect
	github.com/hashicorp/go-msgpack/v2 v2.1.2 // indirect
	github.com/jaegertracing/jaeger-idl v0.5.0 // indirect
	github.com/onsi/ginkgo/v2 v2.22.2 // indirect
	github.com/sercand/kuberesolver/v6 v6.0.0 // indirect
	github.com/spiffe/go-spiffe/v2 v2.5.0 // indirect
	github.com/zeebo/errs v1.4.0 // indirect
	go.opentelemetry.io/contrib/bridges/prometheus v0.61.0 // indirect
	go.opentelemetry.io/contrib/exporters/autoexport v0.61.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploggrpc v0.12.2 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlplog/otlploghttp v0.12.2 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetricgrpc v1.36.0 // indirect
	go.opentelemetry.io/otel/exporters/otlp/otlpmetric/otlpmetrichttp v1.36.0 // indirect
	go.opentelemetry.io/otel/exporters/prometheus v0.58.0 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdoutlog v0.12.2 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdoutmetric v1.36.0 // indirect
	go.opentelemetry.io/otel/exporters/stdout/stdouttrace v1.36.0 // indirect
	go.opentelemetry.io/otel/log v0.12.2 // indirect
	go.opentelemetry.io/otel/sdk/log v0.12.2 // indirect
	gopkg.in/telebot.v3 v3.2.1 // indirect
)

// Use fork of crewjam/saml with fixes for some issues until changes get merged into upstream
replace github.com/crewjam/saml => github.com/grafana/saml v0.4.15-0.20240917091248-ae3bbdad8a56

// Use our fork of the upstream alertmanagers.
// This is required in order to get notification delivery errors from the receivers API.
replace github.com/prometheus/alertmanager => github.com/grafana/prometheus-alertmanager v0.25.1-0.20240930132144-b5e64e81e8d3

exclude github.com/mattn/go-sqlite3 v2.0.3+incompatible

// Use our fork xorm. go.work currently overrides this and points to the local ./pkg/util/xorm directory.
replace xorm.io/xorm => github.com/grafana/grafana/pkg/util/xorm v0.0.1

// lock for mysql tsdb compat
replace github.com/go-sql-driver/mysql => github.com/go-sql-driver/mysql v1.7.1

// v1.* versions were retracted, we need to stick with v0.*. This should work
// without the exclude, but this otherwise gets pulled in as a transitive
// dependency.
exclude github.com/prometheus/prometheus v1.8.2-0.20221021121301-51a44e6657c3

// This was retracted, but seems to be known by the Go module proxy, and is
// otherwise pulled in as a transitive dependency.
exclude k8s.io/client-go v12.0.0+incompatible

// k8s.io/apiserver fails due to incompatibility with cel-go 0.23, can be removed once apiserver v0.32.3 is released.
replace github.com/google/cel-go => github.com/google/cel-go v0.22.1
