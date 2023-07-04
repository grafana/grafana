module github.com/grafana/grafana

go 1.20

// Override xorm's outdated go-mssqldb dependency, since we can't upgrade to current xorm (due to breaking changes).
// We need a more current go-mssqldb so we get rid of a version of apache/thrift with vulnerabilities.
// Also, use our fork with fixes for unimplemented methods (required for Go 1.16).
replace github.com/denisenkom/go-mssqldb => github.com/grafana/go-mssqldb v0.9.2

// Override docker/docker to avoid:
// go: github.com/drone-runners/drone-runner-docker@v1.8.2 requires
// github.com/docker/docker@v0.0.0-00010101000000-000000000000: invalid version: unknown revision 000000000000
replace github.com/docker/docker => github.com/moby/moby v23.0.4+incompatible

// contains openapi encoder fixes. remove ASAP
replace cuelang.org/go => github.com/sdboyer/cue v0.5.0-beta.2.0.20230419165817-251c3ae823d8

// For some insane reason, client-go seems to have a broken v12.0.0 tag on it that forces us to
// hoist a replace statement.
replace k8s.io/client-go => k8s.io/client-go v0.25.3

require k8s.io/apimachinery v0.26.2

// Override Prometheus version because Prometheus v2.X is tagged as v0.X for Go modules purposes and Go assumes
// that v1.Y is higher than v0.X, so when we resolve dependencies if any dependency imports v1.Y we'd
// import that instead of v0.X even though v0.X is newer.
replace github.com/prometheus/prometheus => github.com/prometheus/prometheus v0.43.0

require (
	cloud.google.com/go/storage v1.28.1
	cuelang.org/go v0.6.0-0.dev
	github.com/Azure/azure-sdk-for-go v65.0.0+incompatible
	github.com/Azure/go-autorest/autorest v0.11.28
	github.com/BurntSushi/toml v1.2.1
	github.com/Masterminds/semver v1.5.0
	github.com/VividCortex/mysqlerr v0.0.0-20170204212430-6c6b55f8796f
	github.com/aws/aws-sdk-go v1.44.234
	github.com/beevik/etree v1.1.0
	github.com/benbjohnson/clock v1.3.3
	github.com/bradfitz/gomemcache v0.0.0-20190913173617-a41fca850d0b
	github.com/centrifugal/centrifuge v0.29.1
	github.com/crewjam/saml v0.4.12
	github.com/fatih/color v1.15.0
	github.com/gchaincl/sqlhooks v1.3.0
	github.com/go-git/go-git/v5 v5.4.2
	github.com/go-ldap/ldap/v3 v3.4.4
	github.com/go-openapi/strfmt v0.21.7
	github.com/go-redis/redis/v8 v8.11.5
	github.com/go-sourcemap/sourcemap v2.1.3+incompatible
	github.com/go-sql-driver/mysql v1.7.1
	github.com/go-stack/stack v1.8.1
	github.com/gobwas/glob v0.2.3
	github.com/gofrs/uuid v4.4.0+incompatible // indirect
	github.com/gogo/protobuf v1.3.2
	github.com/golang/mock v1.6.0
	github.com/golang/snappy v0.0.4
	github.com/google/go-cmp v0.5.9
	github.com/google/uuid v1.3.0
	github.com/google/wire v0.5.0
	github.com/gorilla/websocket v1.5.0
	github.com/grafana/alerting v0.0.0-20230606080147-55b8d71c7890
	github.com/grafana/cuetsy v0.1.9
	github.com/grafana/grafana-aws-sdk v0.15.0
	github.com/grafana/grafana-azure-sdk-go v1.7.0
	github.com/grafana/grafana-plugin-sdk-go v0.165.0
	github.com/grpc-ecosystem/go-grpc-middleware v1.4.0
	github.com/hashicorp/go-hclog v1.5.0
	github.com/hashicorp/go-plugin v1.4.9
	github.com/hashicorp/go-version v1.3.0
	github.com/influxdata/influxdb-client-go/v2 v2.6.0
	github.com/influxdata/line-protocol v0.0.0-20210311194329-9aa0e372d097
	github.com/jmespath/go-jmespath v0.4.0
	github.com/json-iterator/go v1.1.12
	github.com/jung-kurt/gofpdf v1.16.2
	github.com/lib/pq v1.10.6
	github.com/linkedin/goavro/v2 v2.10.0
	github.com/m3db/prometheus_remote_client_golang v0.4.4
	github.com/magefile/mage v1.14.0
	github.com/mattn/go-isatty v0.0.18
	github.com/mattn/go-sqlite3 v1.14.16
	github.com/matttproud/golang_protobuf_extensions v1.0.4
	github.com/mwitkow/go-conntrack v0.0.0-20190716064945-2f068394615f
	github.com/opentracing/opentracing-go v1.2.0 // indirect
	github.com/patrickmn/go-cache v2.1.0+incompatible
	github.com/pkg/browser v0.0.0-20210911075715-681adbf594b8 // indirect
	github.com/pkg/errors v0.9.1 // indirect
	github.com/prometheus/alertmanager v0.25.0
	github.com/prometheus/client_golang v1.15.1
	github.com/prometheus/client_model v0.4.0
	github.com/prometheus/common v0.43.0
	github.com/prometheus/prometheus v1.8.2-0.20210621150501-ff58416a0b02
	github.com/robfig/cron/v3 v3.0.1
	github.com/russellhaering/goxmldsig v1.2.0
	github.com/stretchr/testify v1.8.4
	github.com/teris-io/shortid v0.0.0-20171029131806-771a37caa5cf
	github.com/ua-parser/uap-go v0.0.0-20211112212520-00c877edfe0f
	github.com/uber/jaeger-client-go v2.29.1+incompatible // indirect
	github.com/urfave/cli/v2 v2.25.0
	github.com/vectordotdev/go-datemath v0.1.1-0.20220323213446-f3954d0b18ae
	github.com/yalue/merged_fs v1.2.2
	github.com/yudai/gojsondiff v1.0.0
	go.opentelemetry.io/collector v0.31.0
	go.opentelemetry.io/collector/model v0.31.0
	go.opentelemetry.io/contrib/instrumentation/net/http/httptrace/otelhttptrace v0.37.0
	go.opentelemetry.io/otel v1.14.0
	go.opentelemetry.io/otel/exporters/jaeger v1.0.0
	go.opentelemetry.io/otel/sdk v1.14.0
	go.opentelemetry.io/otel/trace v1.14.0
	golang.org/x/crypto v0.7.0
	golang.org/x/exp v0.0.0-20230321023759-10a507213a29
	golang.org/x/net v0.9.0
	golang.org/x/oauth2 v0.7.0
	golang.org/x/sync v0.3.0
	golang.org/x/time v0.3.0
	golang.org/x/tools v0.7.0
	gonum.org/v1/gonum v0.11.0
	google.golang.org/api v0.111.0
	google.golang.org/grpc v1.55.0
	google.golang.org/protobuf v1.30.0
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/ini.v1 v1.67.0
	gopkg.in/mail.v2 v2.3.1
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1
	xorm.io/builder v0.3.6 // indirect
	xorm.io/core v0.7.3
	xorm.io/xorm v0.8.2
)

require (
	github.com/Azure/azure-sdk-for-go/sdk/internal v1.0.0 // indirect
	github.com/Azure/go-autorest v14.2.0+incompatible // indirect
	github.com/Azure/go-autorest/autorest/date v0.3.0 // indirect
	github.com/Azure/go-autorest/autorest/to v0.4.0 // indirect
	github.com/Azure/go-autorest/autorest/validation v0.3.1 // indirect
	github.com/Azure/go-autorest/logger v0.2.1 // indirect
	github.com/Azure/go-autorest/tracing v0.6.0 // indirect
	github.com/FZambia/eagle v0.0.2 // indirect
	github.com/alecthomas/units v0.0.0-20211218093645-b94a6e3cc137 // indirect
	github.com/andybalholm/brotli v1.0.4
	github.com/apache/arrow/go/arrow v0.0.0-20211112161151-bc219186db40 // indirect
	github.com/asaskevich/govalidator v0.0.0-20230301143203-a9d515a09cc2 // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cenkalti/backoff/v4 v4.2.0 // indirect
	github.com/centrifugal/protocol v0.10.0 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/cheekybits/genny v1.0.0 // indirect
	github.com/cockroachdb/apd/v2 v2.0.2 // indirect
	github.com/deepmap/oapi-codegen v1.12.4 // indirect
	github.com/dennwc/varint v1.0.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/docker/go-units v0.5.0 // indirect
	github.com/edsrzf/mmap-go v1.1.0 // indirect
	github.com/emicklei/proto v1.10.0 // indirect
	github.com/go-kit/log v0.2.1
	github.com/go-logfmt/logfmt v0.6.0 // indirect
	github.com/go-openapi/analysis v0.21.4 // indirect
	github.com/go-openapi/errors v0.20.3 // indirect
	github.com/go-openapi/jsonpointer v0.19.6 // indirect
	github.com/go-openapi/jsonreference v0.20.2 // indirect
	github.com/go-openapi/loads v0.21.2
	github.com/go-openapi/runtime v0.25.0 // indirect
	github.com/go-openapi/spec v0.20.8 // indirect
	github.com/go-openapi/swag v0.22.3 // indirect
	github.com/go-openapi/validate v0.22.1 // indirect
	github.com/golang-jwt/jwt/v4 v4.5.0
	github.com/golang-sql/civil v0.0.0-20190719163853-cb61b32ac6fe // indirect
	github.com/golang/glog v1.0.0 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/golang/protobuf v1.5.3
	github.com/google/btree v1.1.2 // indirect
	github.com/google/flatbuffers v2.0.8+incompatible // indirect
	github.com/googleapis/gax-go/v2 v2.7.0
	github.com/gorilla/mux v1.8.0 // indirect
	github.com/grafana/grafana-google-sdk-go v0.1.0
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.1-0.20191002090509-6af20e3a5340 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-msgpack v0.5.5 // indirect
	github.com/hashicorp/go-multierror v1.1.1 // indirect
	github.com/hashicorp/go-sockaddr v1.0.2 // indirect
	github.com/hashicorp/golang-lru v0.6.0 // indirect
	github.com/hashicorp/yamux v0.1.1 // indirect
	github.com/igm/sockjs-go/v3 v3.0.2 // indirect
	github.com/jessevdk/go-flags v1.5.0 // indirect
	github.com/jonboulle/clockwork v0.3.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/jpillora/backoff v1.0.0 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/mattetti/filebuffer v1.0.1 // indirect
	github.com/mattn/go-runewidth v0.0.13 // indirect
	github.com/miekg/dns v1.1.51 // indirect
	github.com/mitchellh/go-testing-interface v1.14.1 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/mpvl/unique v0.0.0-20150818121801-cbe035fff7de // indirect
	github.com/oklog/run v1.1.0 // indirect
	github.com/oklog/ulid v1.3.1 // indirect
	github.com/olekukonko/tablewriter v0.0.5
	github.com/pmezard/go-difflib v1.0.1-0.20181226105442-5d4384ee4fb2 // indirect
	github.com/prometheus/common/sigv4 v0.1.0 // indirect
	github.com/prometheus/exporter-toolkit v0.9.1 // indirect
	github.com/prometheus/procfs v0.9.0 // indirect
	github.com/protocolbuffers/txtpbfmt v0.0.0-20220428173112-74888fd59c2b // indirect
	github.com/rs/cors v1.9.0 // indirect
	github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529 // indirect
	github.com/segmentio/encoding v0.3.6 // indirect
	github.com/sergi/go-diff v1.3.1 // indirect
	github.com/shurcooL/httpfs v0.0.0-20190707220628-8d4bc4ba7749 // indirect
	github.com/shurcooL/vfsgen v0.0.0-20200824052919-0d455de96546 // indirect
	github.com/sirupsen/logrus v1.9.0 // indirect
	github.com/stretchr/objx v0.5.0 // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/yudai/golcs v0.0.0-20170316035057-ecda9a501e82 // indirect
	go.mongodb.org/mongo-driver v1.11.3 // indirect
	go.opencensus.io v0.24.0 // indirect
	go.uber.org/atomic v1.10.0
	go.uber.org/goleak v1.2.1 // indirect
	golang.org/x/sys v0.8.0 // indirect
	golang.org/x/text v0.9.0
	golang.org/x/xerrors v0.0.0-20220907171357-04be3eba64a2 // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/genproto v0.0.0-20230410155749-daa745c078e1
)

require (
	cloud.google.com/go/kms v1.4.0
	github.com/Azure/azure-sdk-for-go/sdk/azidentity v1.2.0
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/azkeys v0.9.0
	github.com/Azure/azure-storage-blob-go v0.15.0
	github.com/Azure/go-autorest/autorest/adal v0.9.22
	github.com/armon/go-radix v1.0.0
	github.com/blugelabs/bluge v0.1.9
	github.com/blugelabs/bluge_segment_api v0.2.0
	github.com/bufbuild/connect-go v1.4.1
	github.com/dlmiddlecote/sqlstats v1.0.2
	github.com/drone/drone-cli v1.6.1
	github.com/getkin/kin-openapi v0.115.0
	github.com/golang-migrate/migrate/v4 v4.7.0
	github.com/google/go-github/v45 v45.2.0
	github.com/grafana/codejen v0.0.3
	github.com/grafana/dskit v0.0.0-20230620150242-3dc2113b720d
	github.com/grafana/phlare/api v0.1.4-0.20230426005640-f90edba05413
	github.com/huandu/xstrings v1.3.1
	github.com/jmoiron/sqlx v1.3.5
	github.com/matryer/is v1.4.0
	github.com/urfave/cli v1.22.12
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.40.0
	go.opentelemetry.io/contrib/propagators/jaeger v1.15.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.14.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.14.0
	gocloud.dev v0.25.0
)

require (
	buf.build/gen/go/parca-dev/parca/bufbuild/connect-go v1.4.1-20221222094228-8b1d3d0f62e6.1
	buf.build/gen/go/parca-dev/parca/protocolbuffers/go v1.28.1-20221222094228-8b1d3d0f62e6.4
	github.com/Masterminds/semver/v3 v3.1.1
	github.com/alicebob/miniredis/v2 v2.30.1
	github.com/dave/dst v0.27.2
	github.com/go-jose/go-jose/v3 v3.0.0
	github.com/grafana/dataplane/examples v0.0.0-20230404174214-4d6fd58a18ad
	github.com/grafana/dataplane/sdata v0.0.6
	github.com/grafana/go-mssqldb v0.9.1
	github.com/grafana/kindsys v0.0.0-20230508162304-452481b63482
	github.com/grafana/thema v0.0.0-20230615161902-b6e21996aef8
	github.com/ory/fosite v0.44.1-0.20230317114349-45a6785cc54f
	github.com/redis/go-redis/v9 v9.0.2
	github.com/weaveworks/common v0.0.0-20230511094633-334485600903
	github.com/xeipuuv/gojsonpointer v0.0.0-20180127040702-4e3ac2762d5f
	go.opentelemetry.io/contrib/samplers/jaegerremote v0.9.0
	gopkg.in/square/go-jose.v2 v2.5.2-0.20210529014059-a5c7eec3c614
	k8s.io/utils v0.0.0-20230308161112-d77c459e9343
)

require (
	cloud.google.com/go v0.107.0 // indirect
	cloud.google.com/go/compute/metadata v0.2.3 // indirect
	github.com/Azure/azure-pipeline-go v0.2.3 // indirect
	github.com/Azure/go-ntlmssp v0.0.0-20220621081337-cb9428e4ac1e // indirect
	github.com/Masterminds/goutils v1.1.1 // indirect
	github.com/alicebob/gopher-json v0.0.0-20200520072559-a9ecdc9d1d3a // indirect
	github.com/apapsch/go-jsonmerge/v2 v2.0.0 // indirect
	github.com/armon/go-metrics v0.4.1 // indirect
	github.com/bmatcuk/doublestar v1.1.1 // indirect
	github.com/buildkite/yaml v2.1.0+incompatible // indirect
	github.com/cloudflare/circl v1.1.0 // indirect
	github.com/cockroachdb/errors v1.9.1 // indirect
	github.com/cockroachdb/logtags v0.0.0-20211118104740-dabe8e521a4f // indirect
	github.com/cockroachdb/redact v1.1.3 // indirect
	github.com/coreos/go-systemd/v22 v22.5.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.2 // indirect
	github.com/cristalhq/jwt/v4 v4.0.2 // indirect
	github.com/dave/jennifer v1.5.0 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/dgraph-io/ristretto v0.1.0 // indirect
	github.com/docker/distribution v2.8.1+incompatible // indirect
	github.com/docker/go-connections v0.4.0 // indirect
	github.com/drone-runners/drone-runner-docker v1.8.2 // indirect
	github.com/drone/drone-go v1.7.1 // indirect
	github.com/drone/envsubst v1.0.3 // indirect
	github.com/drone/runner-go v1.12.0 // indirect
	github.com/dustin/go-humanize v1.0.0 // indirect
	github.com/ecordell/optgen v0.0.6 // indirect
	github.com/fsnotify/fsnotify v1.6.0 // indirect
	github.com/getsentry/sentry-go v0.12.0 // indirect
	github.com/go-asn1-ber/asn1-ber v1.5.4 // indirect
	github.com/google/go-querystring v1.1.0 // indirect
	github.com/google/gofuzz v1.2.0 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.2.3 // indirect
	github.com/grafana/regexp v0.0.0-20221122212121-6b5c0a4cb7fd // indirect
	github.com/grafana/sqlds/v2 v2.3.10 // indirect
	github.com/hashicorp/go-cleanhttp v0.5.2 // indirect
	github.com/hashicorp/go-immutable-radix v1.3.1 // indirect
	github.com/hashicorp/go-retryablehttp v0.7.2 // indirect
	github.com/hashicorp/golang-lru/v2 v2.0.2 // indirect
	github.com/hashicorp/hcl v1.0.0 // indirect
	github.com/hashicorp/memberlist v0.5.0 // indirect
	github.com/inconshreveable/mousetrap v1.0.0 // indirect
	github.com/invopop/yaml v0.1.0 // indirect
	github.com/kr/pretty v0.3.1 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/magiconair/properties v1.8.6 // indirect
	github.com/mattn/go-colorable v0.1.13 // indirect
	github.com/mattn/go-ieproxy v0.0.3 // indirect
	github.com/mattn/goveralls v0.0.6 // indirect
	github.com/mitchellh/copystructure v1.2.0 // indirect
	github.com/mitchellh/mapstructure v1.5.0 // indirect
	github.com/mitchellh/reflectwalk v1.0.2 // indirect
	github.com/mohae/deepcopy v0.0.0-20170929034955-c48cc78d4826 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.3-0.20211202183452-c5a74bcca799 // indirect
	github.com/ory/go-acc v0.2.6 // indirect
	github.com/ory/go-convenience v0.1.0 // indirect
	github.com/ory/viper v1.7.5 // indirect
	github.com/ory/x v0.0.214 // indirect
	github.com/pborman/uuid v1.2.0 // indirect
	github.com/pelletier/go-toml v1.9.5 // indirect
	github.com/perimeterx/marshmallow v1.1.4 // indirect
	github.com/rivo/uniseg v0.3.4 // indirect
	github.com/rogpeppe/go-internal v1.10.0 // indirect
	github.com/rueian/rueidis v0.0.100-go1.18 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/segmentio/asm v1.2.0 // indirect
	github.com/shopspring/decimal v1.2.0 // indirect
	github.com/spf13/afero v1.9.2 // indirect
	github.com/spf13/cast v1.5.0 // indirect
	github.com/spf13/cobra v1.4.0 // indirect
	github.com/spf13/jwalterweatherman v1.1.0 // indirect
	github.com/spf13/pflag v1.0.5 // indirect
	github.com/subosito/gotenv v1.4.1 // indirect
	github.com/unknwon/bra v0.0.0-20200517080246-1e3013ecaff8 // indirect
	github.com/unknwon/com v1.0.1 // indirect
	github.com/unknwon/log v0.0.0-20150304194804-e617c87089d3 // indirect
	github.com/weaveworks/promrus v1.2.0 // indirect
	github.com/xrash/smetrics v0.0.0-20201216005158-039620a65673 // indirect
	github.com/yuin/gopher-lua v1.1.0 // indirect
	go.opentelemetry.io/otel/metric v0.37.0 // indirect
	go.starlark.net v0.0.0-20221020143700-22309ac47eac // indirect
	gopkg.in/fsnotify/fsnotify.v1 v1.4.7 // indirect
	gopkg.in/inf.v0 v0.9.1 // indirect
	k8s.io/klog/v2 v2.90.1 // indirect
	sigs.k8s.io/json v0.0.0-20221116044647-bc3834ca7abd // indirect
	sigs.k8s.io/structured-merge-diff/v4 v4.2.3 // indirect
)

require (
	cloud.google.com/go/compute v1.18.0 // indirect
	cloud.google.com/go/iam v0.8.0 // indirect
	filippo.io/age v1.1.1
	github.com/Azure/azure-sdk-for-go/sdk/azcore v1.2.0 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/internal v0.7.0 // indirect
	github.com/AzureAD/microsoft-authentication-library-for-go v0.7.0 // indirect
	github.com/Masterminds/sprig/v3 v3.2.2
	github.com/Microsoft/go-winio v0.6.0 // indirect
	github.com/ProtonMail/go-crypto v0.0.0-20230426101702-58e86b294756
	github.com/RoaringBitmap/roaring v0.9.4 // indirect
	github.com/acomagu/bufpipe v1.0.3 // indirect
	github.com/axiomhq/hyperloglog v0.0.0-20191112132149-a4c4c47bc57f // indirect
	github.com/bits-and-blooms/bitset v1.2.0 // indirect
	github.com/blevesearch/go-porterstemmer v1.0.3 // indirect
	github.com/blevesearch/mmap-go v1.0.4 // indirect
	github.com/blevesearch/segment v0.9.0 // indirect
	github.com/blevesearch/snowballstem v0.9.0 // indirect
	github.com/blevesearch/vellum v1.0.7 // indirect
	github.com/blugelabs/ice v1.0.0 // indirect
	github.com/caio/go-tdigest v3.1.0+incompatible // indirect
	github.com/chromedp/cdproto v0.0.0-20220208224320-6efb837e6bc2 // indirect
	github.com/dgryski/go-metro v0.0.0-20211217172704-adc40b04c140 // indirect
	github.com/docker/docker v23.0.4+incompatible
	github.com/elazarl/goproxy v0.0.0-20220115173737-adb46da277ac // indirect
	github.com/emirpasic/gods v1.12.0 // indirect
	github.com/ghodss/yaml v1.0.1-0.20190212211648-25d852aebe32 // indirect
	github.com/go-git/gcfg v1.5.0 // indirect
	github.com/go-git/go-billy/v5 v5.3.1 // indirect
	github.com/go-logr/logr v1.2.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/google/go-github v17.0.0+incompatible
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.15.2 // indirect
	github.com/hmarr/codeowners v1.1.2
	github.com/imdario/mergo v0.3.13 // indirect
	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
	github.com/kevinburke/ssh_config v0.0.0-20201106050909-4977a11b4351 // indirect
	github.com/klauspost/compress v1.15.13 // indirect
	github.com/kylelemons/godebug v1.1.0 // indirect
	github.com/labstack/echo/v4 v4.10.2 // indirect
	github.com/labstack/gommon v0.4.0 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
	github.com/mschoch/smat v0.2.0 // indirect
	github.com/pierrec/lz4/v4 v4.1.15 // indirect
	github.com/valyala/fasttemplate v1.2.2 // indirect
	github.com/wk8/go-ordered-map v1.0.0
	github.com/xanzy/ssh-agent v0.3.0 // indirect
	github.com/xlab/treeprint v1.1.0
	go.opentelemetry.io/otel/exporters/otlp/internal/retry v1.14.0 // indirect
	go.opentelemetry.io/proto/otlp v0.19.0 // indirect
	golang.org/x/mod v0.9.0
	gopkg.in/warnings.v0 v0.1.2 // indirect
)

// Use fork of crewjam/saml with fixes for some issues until changes get merged into upstream
replace github.com/crewjam/saml => github.com/grafana/saml v0.4.13-0.20230331080031-67cbfa09c7b6

// Thema's thema CLI requires cobra, which eventually works its way down to go-hclog@v1.0.0.
// Upgrading affects backend plugins: https://github.com/grafana/grafana/pull/47653#discussion_r850508593
// No harm to Thema because it's only a dependency in its main package.
replace github.com/hashicorp/go-hclog => github.com/hashicorp/go-hclog v0.16.1

// This is a patched v0.8.2 intended to fix session.Find (and others) silently ignoring SQLITE_BUSY errors. This could
// happen, for example, during a read when the sqlite db is under heavy write load.
// This patch cherry picks compatible fixes from upstream xorm PR#1998 and can be reverted on upgrade to xorm v1.2.0+.
replace xorm.io/xorm => github.com/grafana/xorm v0.8.3-0.20220614223926-2fcda7565af6

// replace xorm.io/xorm => ./pkg/util/xorm

// Use our fork of the upstream alertmanagers.
// This is required in order to get notification delivery errors from the receivers API.
replace github.com/prometheus/alertmanager => github.com/grafana/prometheus-alertmanager v0.25.1-0.20230508090422-7d5630522a53

// grpc v1.46.0 removed "WithBalancerName()" API, still in use by weaveworks/commons.
replace google.golang.org/grpc => google.golang.org/grpc v1.45.0

replace google.golang.org/genproto => google.golang.org/genproto v0.0.0-20220421151946-72621c1f0bd3

// Use 1.10.6 of pq to avoid a change in 1.10.7 that has certificate validation issues. https://github.com/grafana/grafana/issues/65816
replace github.com/lib/pq => github.com/lib/pq v1.10.6

exclude github.com/mattn/go-sqlite3 v2.0.3+incompatible
