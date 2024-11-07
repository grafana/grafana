module github.com/grafana/grafana

go 1.22.7

// Override docker/docker to avoid:
// go: github.com/drone-runners/drone-runner-docker@v1.8.2 requires
// github.com/docker/docker@v0.0.0-00010101000000-000000000000: invalid version: unknown revision 000000000000
replace github.com/docker/docker => github.com/moby/moby v23.0.4+incompatible

// contains openapi encoder fixes. remove ASAP
replace cuelang.org/go => github.com/grafana/cue v0.0.0-20230926092038-971951014e3f // @grafana/grafana-as-code

// Override Prometheus version because Prometheus v2.X is tagged as v0.X for Go modules purposes and Go assumes
// that v1.Y is higher than v0.X, so when we resolve dependencies if any dependency imports v1.Y we'd
// import that instead of v0.X even though v0.X is newer.
replace github.com/prometheus/prometheus => github.com/prometheus/prometheus v0.52.0

// Update when github.com/deepmap/oapi-codegen/v2 is updated to support later versions.
replace github.com/getkin/kin-openapi => github.com/getkin/kin-openapi v0.122.0

require (
	buf.build/gen/go/parca-dev/parca/bufbuild/connect-go v1.4.1-20221222094228-8b1d3d0f62e6.1 // @grafana/observability-traces-and-profiling
	buf.build/gen/go/parca-dev/parca/protocolbuffers/go v1.33.0-20240414232344-9ca06271cb73.1 // @grafana/observability-traces-and-profiling
	cloud.google.com/go/kms v1.15.7 // @grafana/grafana-backend-group
	cloud.google.com/go/storage v1.38.0 // @grafana/grafana-backend-group
	cuelang.org/go v0.6.0-0.dev // @grafana/grafana-as-code
	filippo.io/age v1.1.1 // @grafana/identity-access-team
	github.com/Azure/azure-sdk-for-go v68.0.0+incompatible // @grafana/partner-datasources
	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.7.0 // @grafana/grafana-backend-group
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/azkeys v0.9.0 // @grafana/grafana-backend-group
	github.com/Azure/azure-storage-blob-go v0.15.0 // @grafana/grafana-backend-group
	github.com/Azure/go-autorest/autorest v0.11.29 // @grafana/grafana-backend-group
	github.com/Azure/go-autorest/autorest/adal v0.9.23 // @grafana/grafana-backend-group
	github.com/BurntSushi/toml v1.3.2 // @grafana/identity-access-team
	github.com/Masterminds/semver v1.5.0 // @grafana/grafana-backend-group
	github.com/Masterminds/semver/v3 v3.2.0 // @grafana/grafana-release-guild
	github.com/Masterminds/sprig/v3 v3.2.3 // @grafana/grafana-backend-group
	github.com/ProtonMail/go-crypto v0.0.0-20230828082145-3c4c8a2d2371 // @grafana/plugins-platform-backend
	github.com/VividCortex/mysqlerr v0.0.0-20170204212430-6c6b55f8796f // @grafana/grafana-backend-group
	github.com/alicebob/miniredis/v2 v2.30.1 // @grafana/alerting-backend
	github.com/andybalholm/brotli v1.0.5 // @grafana/partner-datasources
	github.com/apache/arrow/go/v15 v15.0.2 // @grafana/observability-metrics
	github.com/armon/go-radix v1.0.0 // @grafana/grafana-app-platform-squad
	github.com/aws/aws-sdk-go v1.51.31 // @grafana/aws-datasources
	github.com/beevik/etree v1.2.0 // @grafana/grafana-backend-group
	github.com/benbjohnson/clock v1.3.5 // @grafana/alerting-backend
	github.com/blang/semver/v4 v4.0.0 // indirect; @grafana/grafana-release-guild
	github.com/blugelabs/bluge v0.1.9 // @grafana/grafana-backend-group
	github.com/blugelabs/bluge_segment_api v0.2.0 // @grafana/grafana-backend-group
	github.com/bradfitz/gomemcache v0.0.0-20190913173617-a41fca850d0b // @grafana/grafana-backend-group
	github.com/bufbuild/connect-go v1.10.0 // @grafana/observability-traces-and-profiling
	github.com/bwmarrin/snowflake v0.3.0 // @grafan/grafana-app-platform-squad
	github.com/centrifugal/centrifuge v0.30.2 // @grafana/grafana-app-platform-squad
	github.com/crewjam/saml v0.4.13 // @grafana/identity-access-team
	github.com/dave/dst v0.27.2 // @grafana/grafana-as-code
	github.com/deepmap/oapi-codegen/v2 v2.1.0 // @grafana/grafana-as-code
	github.com/dlmiddlecote/sqlstats v1.0.2 // @grafana/grafana-backend-group
	github.com/fatih/color v1.16.0 // @grafana/grafana-backend-group
	github.com/fullstorydev/grpchan v1.1.1 // @grafana/grafana-backend-group
	github.com/gchaincl/sqlhooks v1.3.0 // @grafana/grafana-search-and-storage
	github.com/getkin/kin-openapi v0.124.0 // @grafana/grafana-as-code
	github.com/go-jose/go-jose/v3 v3.0.3 // @grafana/identity-access-team
	github.com/go-kit/log v0.2.1 //  @grafana/grafana-backend-group
	github.com/go-ldap/ldap/v3 v3.4.4 // @grafana/identity-access-team
	github.com/go-openapi/loads v0.21.5 // @grafana/alerting-backend
	github.com/go-openapi/runtime v0.27.1 // @grafana/alerting-backend
	github.com/go-openapi/strfmt v0.23.0 // @grafana/alerting-backend
	github.com/go-redis/redis/v8 v8.11.5 // @grafana/grafana-backend-group
	github.com/go-sourcemap/sourcemap v2.1.3+incompatible // @grafana/grafana-backend-group
	github.com/go-sql-driver/mysql v1.7.1 // @grafana/grafana-search-and-storage
	github.com/go-stack/stack v1.8.1 // @grafana/grafana-backend-group
	github.com/gobwas/glob v0.2.3 // @grafana/grafana-backend-group
	github.com/gogo/protobuf v1.3.2 // @grafana/alerting-backend
	github.com/golang-jwt/jwt/v4 v4.5.0 // @grafana/grafana-backend-group
	github.com/golang-migrate/migrate/v4 v4.7.0 // @grafana/grafana-backend-group
	github.com/golang/mock v1.6.0 // @grafana/alerting-backend
	github.com/golang/protobuf v1.5.4 // @grafana/grafana-backend-group
	github.com/golang/snappy v0.0.4 // @grafana/alerting-backend
	github.com/google/go-cmp v0.6.0 // @grafana/grafana-backend-group
	github.com/google/uuid v1.6.0 // @grafana/grafana-backend-group
	github.com/google/wire v0.5.0 // @grafana/grafana-backend-group
	github.com/googleapis/gax-go/v2 v2.12.3 // @grafana/grafana-backend-group
	github.com/gorilla/mux v1.8.1 // @grafana/grafana-backend-group
	github.com/gorilla/websocket v1.5.0 // @grafana/grafana-app-platform-squad
	github.com/grafana/alerting v0.0.0-20240712181403-02e012d6dd7f // @grafana/alerting-backend
	github.com/grafana/authlib v0.0.0-20240515154731-fe4779055ef4 // @grafana/identity-access-team
	github.com/grafana/codejen v0.0.3 // @grafana/dataviz-squad
	github.com/grafana/cuetsy v0.1.11 // @grafana/grafana-as-code
	github.com/grafana/dataplane/examples v0.0.1 // @grafana/observability-metrics
	github.com/grafana/dataplane/sdata v0.0.9 // @grafana/observability-metrics
	github.com/grafana/dskit v0.0.0-20240104111617-ea101a3b86eb // @grafana/grafana-backend-group
	github.com/grafana/gofpdf v0.0.0-20231002120153-857cc45be447 // @grafana/sharing-squad
	github.com/grafana/gomemcache v0.0.0-20231023152154-6947259a0586 // @grafana/grafana-operator-experience-squad
	github.com/grafana/grafana-aws-sdk v0.26.1 // @grafana/aws-datasources
	github.com/grafana/grafana-azure-sdk-go/v2 v2.0.4 // @grafana/partner-datasources
	github.com/grafana/grafana-google-sdk-go v0.1.0 // @grafana/partner-datasources
	github.com/grafana/grafana-openapi-client-go v0.0.0-20231213163343-bd475d63fb79 // @grafana/grafana-backend-group
	github.com/grafana/grafana-plugin-sdk-go v0.234.0 // @grafana/plugins-platform-backend
	github.com/grafana/grafana/pkg/apimachinery v0.0.0-20240226124929-648abdbd0ea4 // @grafana/grafana-app-platform-squad
	github.com/grafana/grafana/pkg/apiserver v0.0.0-20240226124929-648abdbd0ea4 // @grafana/grafana-app-platform-squad
	// This needs to be here for other projects that import grafana/grafana
	// For local development grafana/grafana will always use the local files
	// Check go.work file for details
	github.com/grafana/grafana/pkg/promlib v0.0.6 // @grafana/observability-metrics
	github.com/grafana/otel-profiling-go v0.5.1 // @grafana/grafana-backend-group
	github.com/grafana/pyroscope-go/godeltaprof v0.1.8 // @grafana/observability-traces-and-profiling
	github.com/grafana/pyroscope/api v0.3.0 // @grafana/observability-traces-and-profiling
	github.com/grafana/tempo v1.5.1-0.20230524121406-1dc1bfe7085b // @grafana/observability-traces-and-profiling
	github.com/grpc-ecosystem/go-grpc-middleware/providers/prometheus v1.0.1 // @grafana/plugins-platform-backend
	github.com/grpc-ecosystem/go-grpc-middleware/v2 v2.1.0 // @grafana/grafana-backend-group
	github.com/hashicorp/go-hclog v1.6.3 // @grafana/plugins-platform-backend
	github.com/hashicorp/go-multierror v1.1.1 // @grafana/alerting-squad
	github.com/hashicorp/go-plugin v1.6.1 // @grafana/plugins-platform-backend
	github.com/hashicorp/go-version v1.6.0 // @grafana/grafana-backend-group
	github.com/hashicorp/golang-lru/v2 v2.0.7 // @grafana/alerting-backend
	github.com/hashicorp/hcl/v2 v2.17.0 // @grafana/alerting-backend
	github.com/huandu/xstrings v1.3.3 // @grafana/partner-datasources
	github.com/influxdata/influxdb-client-go/v2 v2.13.0 // @grafana/observability-metrics
	github.com/influxdata/line-protocol v0.0.0-20210922203350-b1ad95c89adf // @grafana/grafana-app-platform-squad
	github.com/jmespath/go-jmespath v0.4.0 // @grafana/grafana-backend-group
	github.com/jmoiron/sqlx v1.3.5 // @grafana/grafana-backend-group
	github.com/json-iterator/go v1.1.12 // @grafana/grafana-backend-group
	github.com/lib/pq v1.10.9 // @grafana/grafana-backend-group
	github.com/linkedin/goavro/v2 v2.10.0 // @grafana/grafana-backend-group
	github.com/m3db/prometheus_remote_client_golang v0.4.4 // @grafana/grafana-backend-group
	github.com/madflojo/testcerts v1.1.1 // @grafana/alerting-backend
	github.com/magefile/mage v1.15.0 // @grafana/grafana-release-guild
	github.com/matryer/is v1.4.0 // @grafana/grafana-as-code
	github.com/mattn/go-isatty v0.0.20 // @grafana/grafana-backend-group
	github.com/mattn/go-sqlite3 v1.14.22 // @grafana/grafana-backend-group
	github.com/matttproud/golang_protobuf_extensions v1.0.4 // @grafana/alerting-backend
	github.com/microsoft/go-mssqldb v1.6.1-0.20240214161942-b65008136246 // @grafana/grafana-bi-squad
	github.com/mitchellh/mapstructure v1.5.0 //@grafana/identity-access-team
	github.com/modern-go/reflect2 v1.0.2 // @grafana/alerting-backend
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // @grafana/alerting-backend
	github.com/mwitkow/go-conntrack v0.0.0-20190716064945-2f068394615f // @grafana/grafana-operator-experience-squad
	github.com/olekukonko/tablewriter v0.0.5 // @grafana/grafana-backend-group
	github.com/patrickmn/go-cache v2.1.0+incompatible // @grafana/alerting-backend
	github.com/prometheus/alertmanager v0.27.0 // @grafana/alerting-backend
	github.com/prometheus/client_golang v1.19.0 // @grafana/alerting-backend
	github.com/prometheus/client_model v0.6.1 // @grafana/grafana-backend-group
	github.com/prometheus/common v0.53.0 // @grafana/alerting-backend
	github.com/prometheus/prometheus v1.8.2-0.20221021121301-51a44e6657c3 // @grafana/alerting-backend
	github.com/redis/go-redis/v9 v9.1.0 // @grafana/alerting-backend
	github.com/robfig/cron/v3 v3.0.1 // @grafana/grafana-backend-group
	github.com/russellhaering/goxmldsig v1.4.0 // @grafana/grafana-backend-group
	github.com/spf13/cobra v1.8.0 // @grafana/grafana-app-platform-squad
	github.com/spf13/pflag v1.0.5 // @grafana-app-platform-squad
	github.com/spyzhov/ajson v0.9.0 // @grafana/grafana-app-platform-squad
	github.com/stretchr/testify v1.9.0 // @grafana/grafana-backend-group
	github.com/teris-io/shortid v0.0.0-20171029131806-771a37caa5cf // @grafana/grafana-backend-group
	github.com/ua-parser/uap-go v0.0.0-20211112212520-00c877edfe0f // @grafana/grafana-backend-group
	github.com/urfave/cli v1.22.15 // indirect; @grafana/grafana-backend-group
	github.com/urfave/cli/v2 v2.27.1 // @grafana/grafana-backend-group
	github.com/wk8/go-ordered-map v1.0.0 // @grafana/grafana-backend-group
	github.com/xlab/treeprint v1.2.0 // @grafana/observability-traces-and-profiling
	github.com/yudai/gojsondiff v1.0.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/collector/pdata v1.6.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.51.0 // @grafana/plugins-platform-backend
	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.51.0 // @grafana/grafana-operator-experience-squad
	go.opentelemetry.io/contrib/propagators/jaeger v1.26.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/contrib/samplers/jaegerremote v0.20.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel v1.27.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/jaeger v1.17.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.27.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.27.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/sdk v1.27.0 // @grafana/grafana-backend-group
	go.opentelemetry.io/otel/trace v1.27.0 // @grafana/grafana-backend-group
	go.uber.org/atomic v1.11.0 // @grafana/alerting-backend
	go.uber.org/goleak v1.3.0 // @grafana/grafana-search-and-storage
	gocloud.dev v0.25.0 // @grafana/grafana-app-platform-squad
	golang.org/x/crypto v0.24.0 // @grafana/grafana-backend-group
	golang.org/x/exp v0.0.0-20240416160154-fe59bbe5cc7f // @grafana/alerting-backend
	golang.org/x/mod v0.18.0 // indirect; @grafana/grafana-backend-group
	golang.org/x/net v0.26.0 // @grafana/oss-big-tent @grafana/partner-datasources
	golang.org/x/oauth2 v0.20.0 // @grafana/identity-access-team
	golang.org/x/sync v0.7.0 // @grafana/alerting-backend
	golang.org/x/text v0.16.0 // @grafana/grafana-backend-group
	golang.org/x/time v0.5.0 // @grafana/grafana-backend-group
	golang.org/x/tools v0.22.0 // @grafana/grafana-as-code
	gonum.org/v1/gonum v0.12.0 // @grafana/observability-metrics
	google.golang.org/api v0.176.0 // @grafana/grafana-backend-group
	google.golang.org/grpc v1.64.0 // @grafana/plugins-platform-backend
	google.golang.org/protobuf v1.34.1 // @grafana/plugins-platform-backend
	gopkg.in/ini.v1 v1.67.0 // @grafana/alerting-backend
	gopkg.in/mail.v2 v2.3.1 // @grafana/grafana-backend-group
	gopkg.in/yaml.v3 v3.0.1 // @grafana/alerting-backend
	k8s.io/api v0.29.3 // @grafana/grafana-app-platform-squad
	k8s.io/apimachinery v0.29.3 // @grafana/grafana-app-platform-squad
	k8s.io/apiserver v0.29.2 // @grafana/grafana-app-platform-squad
	k8s.io/client-go v0.29.3 // @grafana/grafana-app-platform-squad
	k8s.io/code-generator v0.29.1 // @grafana/grafana-app-platform-squad
	k8s.io/component-base v0.29.2 // @grafana/grafana-app-platform-squad
	k8s.io/klog/v2 v2.120.1 // @grafana/grafana-app-platform-squad
	k8s.io/kube-aggregator v0.29.0 // @grafana/grafana-app-platform-squad
	k8s.io/kube-openapi v0.0.0-20240228011516-70dd3763d340 // @grafana/grafana-app-platform-squad
	k8s.io/utils v0.0.0-20230726121419-3b25d923346b // @grafana/partner-datasources
	sigs.k8s.io/structured-merge-diff/v4 v4.4.1 // @grafana-app-platform-squad
	xorm.io/builder v0.3.6 // @grafana/grafana-backend-group
	xorm.io/core v0.7.3 // @grafana/grafana-backend-group
	xorm.io/xorm v0.8.2 // @grafana/alerting-backend
)

require (
	cloud.google.com/go v0.112.1 // indirect
	cloud.google.com/go/auth v0.2.2 // indirect
	cloud.google.com/go/auth/oauth2adapt v0.2.1 // indirect
	cloud.google.com/go/compute/metadata v0.3.0 // indirect
	cloud.google.com/go/iam v1.1.6 // indirect
	github.com/Azure/azure-pipeline-go v0.2.3 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.11.1 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/internal v1.8.0 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/internal v0.7.0 // indirect
	github.com/Azure/go-autorest v14.2.0+incompatible // indirect
	github.com/Azure/go-autorest/autorest/date v0.3.0 // indirect
	github.com/Azure/go-autorest/autorest/to v0.4.0 // indirect
	github.com/Azure/go-autorest/autorest/validation v0.3.1 // indirect
	github.com/Azure/go-autorest/logger v0.2.1 // indirect
	github.com/Azure/go-autorest/tracing v0.6.0 // indirect
	github.com/Azure/go-ntlmssp v0.0.0-20220621081337-cb9428e4ac1e // indirect
	github.com/AzureAD/microsoft-authentication-library-for-go v1.2.2 // indirect
	github.com/DATA-DOG/go-sqlmock v1.5.2 // @grafana/grafana-search-and-storage
	github.com/FZambia/eagle v0.1.0 // indirect
	github.com/Masterminds/goutils v1.1.1 // indirect
	github.com/NYTimes/gziphandler v1.1.1 // indirect
	github.com/RoaringBitmap/roaring v0.9.4 // indirect
	github.com/agext/levenshtein v1.2.1 // indirect
	github.com/alecthomas/units v0.0.0-20231202071711-9a357b53e9c9 // indirect
	github.com/alicebob/gopher-json v0.0.0-20200520072559-a9ecdc9d1d3a // indirect
	github.com/antlr/antlr4/runtime/Go/antlr/v4 v4.0.0-20230512164433-5d1fd1a340c9 // indirect
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/apparentlymart/go-textseg/v13 v13.0.0 // indirect
	github.com/armon/go-metrics v0.4.1 // indirect
	github.com/asaskevich/govalidator v0.0.0-20230301143203-a9d515a09cc2 // indirect
	github.com/axiomhq/hyperloglog v0.0.0-20191112132149-a4c4c47bc57f // indirect
	github.com/bahlo/generic-list-go v0.2.0 // indirect
	github.com/bboreham/go-loser v0.0.0-20230920113527-fcc2c21820a3 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/bits-and-blooms/bitset v1.2.0 // indirect
	github.com/blevesearch/go-porterstemmer v1.0.3 // indirect
	github.com/blevesearch/mmap-go v1.0.4 // indirect
	github.com/blevesearch/segment v0.9.0 // indirect
	github.com/blevesearch/snowballstem v0.9.0 // indirect
	github.com/blevesearch/vellum v1.0.7 // indirect
	github.com/blugelabs/ice v1.0.0 // indirect
	github.com/bufbuild/protocompile v0.4.0 // indirect
	github.com/buger/jsonparser v1.1.1 // indirect
	github.com/caio/go-tdigest v3.1.0+incompatible // indirect
	github.com/cenkalti/backoff/v4 v4.3.0 // indirect
	github.com/centrifugal/protocol v0.10.0 // indirect
	github.com/cespare/xxhash/v2 v2.3.0 // indirect
	github.com/cheekybits/genny v1.0.0 // indirect
	github.com/chromedp/cdproto v0.0.0-20240426225625-909263490071 // indirect
	github.com/cloudflare/circl v1.3.7 // indirect
	github.com/cockroachdb/apd/v2 v2.0.2 // indirect
	github.com/coreos/go-semver v0.3.1 // indirect
	github.com/coreos/go-systemd/v22 v22.5.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.4 // indirect
	github.com/davecgh/go-spew v1.1.2-0.20180830191138-d8f796af33cc // indirect
	github.com/dennwc/varint v1.0.0 // indirect
	github.com/dgryski/go-metro v0.0.0-20211217172704-adc40b04c140 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/docker/distribution v2.8.2+incompatible // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/dustin/go-humanize v1.0.1 // indirect
	github.com/edsrzf/mmap-go v1.1.0 // indirect
	github.com/elazarl/goproxy v0.0.0-20231117061959-7cc037d33fb5 // indirect
	github.com/emicklei/go-restful/v3 v3.11.0 // indirect
	github.com/emicklei/proto v1.10.0 // indirect
	github.com/evanphx/json-patch v5.6.0+incompatible // indirect
	github.com/facette/natsort v0.0.0-20181210072756-2cd4dd1e2dcb // indirect
	github.com/felixge/httpsnoop v1.0.4 // indirect
	github.com/fsnotify/fsnotify v1.7.0 // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.4 // indirect
	github.com/go-logfmt/logfmt v0.6.0 // indirect
	github.com/go-logr/logr v1.4.1 // indirect; @grafana/grafana-app-platform-squad
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/go-logr/zapr v1.3.0 // indirect
	github.com/go-openapi/analysis v0.22.2 // indirect
	github.com/go-openapi/errors v0.22.0 // indirect
	github.com/go-openapi/jsonpointer v0.21.0 // indirect
	github.com/go-openapi/jsonreference v0.20.4 // indirect
	github.com/go-openapi/spec v0.20.14 // indirect
	github.com/go-openapi/swag v0.23.0 // indirect
	github.com/go-openapi/validate v0.23.0 // indirect
	github.com/goccy/go-json v0.10.2 // indirect
	github.com/gofrs/uuid v4.4.0+incompatible // indirect
	github.com/gogo/googleapis v1.4.1 // indirect
	github.com/gogo/status v1.1.1 // indirect
	github.com/golang-jwt/jwt/v5 v5.2.1 // indirect
	github.com/golang-sql/civil v0.0.0-20220223132316-b832511892a9 // indirect
	github.com/golang-sql/sqlexp v0.1.0 // indirect
	github.com/golang/glog v1.2.0 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/google/btree v1.1.2 // indirect
	github.com/google/cel-go v0.17.7 // indirect
	github.com/google/flatbuffers v24.3.25+incompatible // indirect
	github.com/google/gnostic-models v0.6.8 // indirect
	github.com/google/gofuzz v1.2.0 // indirect
	github.com/google/s2a-go v0.1.7 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.3.2 // indirect
	github.com/grafana/regexp v0.0.0-20221123153739-15dc172cd2db // indirect
	github.com/grafana/sqlds/v3 v3.2.0 // indirect
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.1-0.20191002090509-6af20e3a5340 // indirect; @grafana/plugins-platform-backend
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.20.0 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-immutable-radix v1.3.1 // indirect
	github.com/hashicorp/go-msgpack v0.5.5 // indirect
	github.com/hashicorp/go-sockaddr v1.0.6 // indirect
	github.com/hashicorp/go-uuid v1.0.3 // indirect
	github.com/hashicorp/golang-lru v0.6.0 // indirect
	github.com/hashicorp/memberlist v0.5.0 // indirect
	github.com/hashicorp/yamux v0.1.1 // indirect
	github.com/igm/sockjs-go/v3 v3.0.2 // indirect
	github.com/imdario/mergo v0.3.16 // indirect
	github.com/inconshreveable/mousetrap v1.1.0 // indirect
	github.com/invopop/jsonschema v0.12.0 // indirect
	github.com/invopop/yaml v0.3.1 // indirect
	github.com/jcmturner/aescts/v2 v2.0.0 // indirect
	github.com/jcmturner/dnsutils/v2 v2.0.0 // indirect
	github.com/jcmturner/gofork v1.7.6 // indirect
	github.com/jcmturner/goidentity/v6 v6.0.1 // indirect
	github.com/jcmturner/gokrb5/v8 v8.4.4 // indirect
	github.com/jcmturner/rpc/v2 v2.0.3 // indirect
	github.com/jeremywohl/flatten v1.0.1 // @grafana/grafana-app-platform-squad
	github.com/jessevdk/go-flags v1.5.0 // indirect
	github.com/jhump/protoreflect v1.15.1 // indirect
	github.com/jonboulle/clockwork v0.4.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/jpillora/backoff v1.0.0 // indirect
	github.com/jszwedko/go-datemath v0.1.1-0.20230526204004-640a500621d6 // indirect
	github.com/kballard/go-shellquote v0.0.0-20180428030007-95032a82bc51 // indirect
	github.com/klauspost/compress v1.17.11 // indirect
	github.com/klauspost/cpuid/v2 v2.2.7 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/kylelemons/godebug v1.1.0 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/mattetti/filebuffer v1.0.1 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-ieproxy v0.0.3 // indirect
	github.com/mattn/go-runewidth v0.0.15 // indirect
	github.com/miekg/dns v1.1.59 // indirect
	github.com/mitchellh/copystructure v1.2.0 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/mithrandie/csvq v1.18.1 // indirect
	github.com/mithrandie/csvq-driver v1.7.0 // indirect
	github.com/mithrandie/go-file/v2 v2.1.0 // indirect
	github.com/mithrandie/go-text v1.6.0 // indirect
	github.com/mithrandie/ternary v1.1.1 // indirect
	github.com/moby/spdystream v0.2.0 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/mpvl/unique v0.0.0-20150818121801-cbe035fff7de // indirect
	github.com/mschoch/smat v0.2.0 // indirect
	github.com/munnerz/goautoneg v0.0.0-20191010083416-a7dc8b61c822 // indirect
	github.com/mxk/go-flowrate v0.0.0-20140419014527-cca7078d478f // indirect
	github.com/oapi-codegen/runtime v1.1.1 // indirect
	github.com/oklog/run v1.1.0 // indirect
	github.com/oklog/ulid v1.3.1 // indirect
	github.com/opentracing-contrib/go-stdlib v1.0.0 // indirect
	github.com/opentracing/opentracing-go v1.2.0 // indirect
	github.com/perimeterx/marshmallow v1.1.5 // indirect
	github.com/pierrec/lz4/v4 v4.1.21 // indirect
	github.com/pkg/browser v0.0.0-20240102092130-5ac0b6a4141c // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/prometheus/common/sigv4 v0.1.0 // indirect
	github.com/prometheus/exporter-toolkit v0.11.0 // indirect
	github.com/prometheus/procfs v0.14.0 // indirect
	github.com/protocolbuffers/txtpbfmt v0.0.0-20220428173112-74888fd59c2b // indirect
	github.com/redis/rueidis v1.0.16 // indirect
	github.com/remyoudompheng/bigfft v0.0.0-20230129092748-24d4a6f8daec // indirect
	github.com/rivo/uniseg v0.4.7 // indirect
	github.com/rs/cors v1.10.1 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	github.com/segmentio/encoding v0.3.6 // indirect
	github.com/sergi/go-diff v1.3.2-0.20230802210424-5b0b94c5c0d3 // indirect
	github.com/shopspring/decimal v1.2.0 // indirect
	github.com/shurcooL/httpfs v0.0.0-20230704072500-f1e31cf0ba5c // indirect
	github.com/shurcooL/vfsgen v0.0.0-20200824052919-0d455de96546 // indirect
	github.com/spf13/cast v1.5.0 // indirect
	github.com/stoewer/go-strcase v1.3.0 // indirect
	github.com/stretchr/objx v0.5.2 // indirect
	github.com/uber/jaeger-client-go v2.30.0+incompatible // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/unknwon/bra v0.0.0-20200517080246-1e3013ecaff8 // indirect
	github.com/unknwon/com v1.0.1 // indirect
	github.com/unknwon/log v0.0.0-20200308114134-929b1006e34a // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/wk8/go-ordered-map/v2 v2.1.8 // indirect
	github.com/xrash/smetrics v0.0.0-20201216005158-039620a65673 // indirect
	github.com/yudai/golcs v0.0.0-20170316035057-ecda9a501e82 // indirect
	github.com/yudai/pp v2.0.1+incompatible // indirect
	github.com/yuin/gopher-lua v1.1.0 // indirect
	github.com/zclconf/go-cty v1.13.0 // indirect
	github.com/zeebo/xxh3 v1.0.2 // indirect
	go.etcd.io/etcd/api/v3 v3.5.10 // indirect
	go.etcd.io/etcd/client/pkg/v3 v3.5.10 // indirect
	go.etcd.io/etcd/client/v3 v3.5.10 // indirect
	go.mongodb.org/mongo-driver v1.14.0 // indirect
	go.opencensus.io v0.24.0 // indirect
	go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp v0.51.0 // indirect
	go.opentelemetry.io/otel/metric v1.27.0 // indirect
	go.opentelemetry.io/proto/otlp v1.3.1 // indirect
	go.uber.org/multierr v1.11.0 // indirect
	go.uber.org/zap v1.26.0 // indirect
	golang.org/x/sys v0.21.0 // indirect
	golang.org/x/term v0.21.0 // indirect
	golang.org/x/xerrors v0.0.0-20231012003039-104605ab7028 // indirect
	google.golang.org/genproto v0.0.0-20240227224415-6ceb2ff114de // indirect; @grafana/grafana-backend-group
	google.golang.org/genproto/googleapis/api v0.0.0-20240604185151-ef581f913117 // indirect
	google.golang.org/genproto/googleapis/rpc v0.0.0-20240604185151-ef581f913117 // indirect
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/fsnotify/fsnotify.v1 v1.4.7 // indirect
	gopkg.in/inf.v0 v0.9.1 // indirect
	gopkg.in/natefinch/lumberjack.v2 v2.2.1 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	k8s.io/kms v0.29.2 // indirect
	lukechampine.com/uint128 v1.3.0 // indirect
	modernc.org/cc/v3 v3.40.0 // indirect
	modernc.org/ccgo/v3 v3.16.13 // indirect
	modernc.org/libc v1.22.4 // indirect
	modernc.org/mathutil v1.5.0 // indirect
	modernc.org/memory v1.5.0 // indirect
	modernc.org/opt v0.1.3 // indirect
	modernc.org/sqlite v1.21.2 // indirect
	modernc.org/strutil v1.1.3 // indirect
	modernc.org/token v1.1.0 // indirect
	sigs.k8s.io/apiserver-network-proxy/konnectivity-client v0.28.0 // indirect
	sigs.k8s.io/json v0.0.0-20221116044647-bc3834ca7abd // indirect
	sigs.k8s.io/yaml v1.3.0 // indirect; @grafana-app-platform-squad
)

require github.com/hashicorp/go-retryablehttp v0.7.7 // indirect

// Use fork of crewjam/saml with fixes for some issues until changes get merged into upstream
replace github.com/crewjam/saml => github.com/grafana/saml v0.4.15-0.20240523142256-cc370b98af7c

// replace github.com/google/cel-go => github.com/google/cel-go v0.16.1

// Use our fork of the upstream alertmanagers.
// This is required in order to get notification delivery errors from the receivers API.
replace github.com/prometheus/alertmanager => github.com/grafana/prometheus-alertmanager v0.25.1-0.20240422145632-c33c6b5b6e6b

exclude github.com/mattn/go-sqlite3 v2.0.3+incompatible

// Use our fork xorm. go.work currently overrides this and points to the local ./pkg/util/xorm directory.
replace xorm.io/xorm => github.com/grafana/grafana/pkg/util/xorm v0.0.1
