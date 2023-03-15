module github.com/grafana/grafana

go 1.19

// Override xorm's outdated go-mssqldb dependency, since we can't upgrade to current xorm (due to breaking changes).
// We need a more current go-mssqldb so we get rid of a version of apache/thrift with vulnerabilities.
// Also, use our fork with fixes for unimplemented methods (required for Go 1.16).
replace github.com/denisenkom/go-mssqldb => github.com/grafana/go-mssqldb v0.0.0-20210326084033-d0ce3c521036

// Override k8s.io/client-go outdated dependency, which is an indirect dependency of grafana/loki.
// It's also present on grafana/loki's go.mod so we'll need till it gets updated.
replace k8s.io/client-go => k8s.io/client-go v0.22.1

replace github.com/russellhaering/goxmldsig@v1.1.0 => github.com/russellhaering/goxmldsig v1.1.1

// Avoid using v2.0.0+incompatible Redigo used by dependencies as the latest maintained branch of Redigo is v1.
replace github.com/gomodule/redigo => github.com/gomodule/redigo v1.8.9

// Override docker/docker to avoid:
// go: github.com/drone-runners/drone-runner-docker@v1.8.2 requires
// github.com/docker/docker@v0.0.0-00010101000000-000000000000: invalid version: unknown revision 000000000000
replace github.com/docker/docker => github.com/moby/moby v0.7.3-0.20190826074503-38ab9da00309

require (
	cloud.google.com/go/storage v1.22.1
	cuelang.org/go v0.4.3
	github.com/Azure/azure-sdk-for-go v65.0.0+incompatible
	github.com/Azure/go-autorest/autorest v0.11.27
	github.com/BurntSushi/toml v1.1.0
	github.com/Masterminds/semver v1.5.0
	github.com/VividCortex/mysqlerr v0.0.0-20170204212430-6c6b55f8796f
	github.com/aws/aws-sdk-go v1.44.171
	github.com/beevik/etree v1.1.0
	github.com/benbjohnson/clock v1.3.0
	github.com/bradfitz/gomemcache v0.0.0-20190913173617-a41fca850d0b
	github.com/centrifugal/centrifuge v0.25.0
	github.com/cortexproject/cortex v1.10.1-0.20211014125347-85c378182d0d
	github.com/crewjam/saml v0.4.9
	github.com/denisenkom/go-mssqldb v0.12.0
	github.com/fatih/color v1.13.0
	github.com/gchaincl/sqlhooks v1.3.0
	github.com/getsentry/sentry-go v0.13.0
	github.com/go-git/go-git/v5 v5.4.2
	github.com/go-kit/kit v0.12.0
	github.com/go-openapi/strfmt v0.21.3
	github.com/go-redis/redis/v8 v8.11.4
	github.com/go-sourcemap/sourcemap v2.1.3+incompatible
	github.com/go-sql-driver/mysql v1.6.0
	github.com/go-stack/stack v1.8.1
	github.com/gobwas/glob v0.2.3
	github.com/gofrs/uuid v4.3.1+incompatible // indirect
	github.com/gogo/protobuf v1.3.2
	github.com/golang/mock v1.6.0
	github.com/golang/snappy v0.0.4
	github.com/google/go-cmp v0.5.9
	github.com/google/uuid v1.3.0
	github.com/google/wire v0.5.0
	github.com/gorilla/websocket v1.5.0
	github.com/gosimple/slug v1.12.0
	github.com/grafana/cuetsy v0.1.1
	github.com/grafana/grafana-aws-sdk v0.11.0
	github.com/grafana/grafana-azure-sdk-go v1.3.1
	github.com/grafana/grafana-plugin-sdk-go v0.142.0
	github.com/grafana/thema v0.0.0-20221113112305-b441ed85a1fd
	github.com/grpc-ecosystem/go-grpc-middleware v1.3.0
	github.com/hashicorp/go-hclog v1.2.0
	github.com/hashicorp/go-plugin v1.4.3
	github.com/hashicorp/go-version v1.3.0
	github.com/influxdata/influxdb-client-go/v2 v2.6.0
	github.com/influxdata/line-protocol v0.0.0-20210311194329-9aa0e372d097
	github.com/jmespath/go-jmespath v0.4.0
	github.com/json-iterator/go v1.1.12
	github.com/jung-kurt/gofpdf v1.16.2
	github.com/lib/pq v1.10.4
	github.com/linkedin/goavro/v2 v2.10.0
	github.com/m3db/prometheus_remote_client_golang v0.4.4
	github.com/magefile/mage v1.13.0
	github.com/mattn/go-isatty v0.0.14
	github.com/mattn/go-sqlite3 v1.14.16
	github.com/matttproud/golang_protobuf_extensions v1.0.4
	github.com/mwitkow/go-conntrack v0.0.0-20190716064945-2f068394615f
	github.com/opentracing/opentracing-go v1.2.0
	github.com/patrickmn/go-cache v2.1.0+incompatible
	github.com/pkg/browser v0.0.0-20210911075715-681adbf594b8 // indirect
	github.com/pkg/errors v0.9.1
	github.com/prometheus/alertmanager v0.24.1-0.20221003101219-ae510d09c048
	github.com/prometheus/client_golang v1.14.0
	github.com/prometheus/client_model v0.3.0
	github.com/prometheus/common v0.39.0
	github.com/prometheus/prometheus v1.8.2-0.20211011171444-354d8d2ecfac
	github.com/robfig/cron/v3 v3.0.1
	github.com/russellhaering/goxmldsig v1.1.1
	github.com/stretchr/testify v1.8.1
	github.com/teris-io/shortid v0.0.0-20171029131806-771a37caa5cf
	github.com/ua-parser/uap-go v0.0.0-20211112212520-00c877edfe0f
	github.com/uber/jaeger-client-go v2.29.1+incompatible
	github.com/urfave/cli/v2 v2.3.0
	github.com/vectordotdev/go-datemath v0.1.1-0.20220323213446-f3954d0b18ae
	github.com/weaveworks/common v0.0.0-20210913144402-035033b78a78 // indirect
	github.com/xorcare/pointer v1.1.0
	github.com/yalue/merged_fs v1.2.2
	github.com/yudai/gojsondiff v1.0.0
	go.opentelemetry.io/collector v0.31.0
	go.opentelemetry.io/collector/model v0.31.0
	go.opentelemetry.io/otel v1.11.1
	go.opentelemetry.io/otel/exporters/jaeger v1.0.0
	go.opentelemetry.io/otel/sdk v1.11.1
	go.opentelemetry.io/otel/trace v1.11.1
	golang.org/x/crypto v0.1.0
	golang.org/x/exp v0.0.0-20220613132600-b0d781184e0d
	golang.org/x/net v0.4.0
	golang.org/x/oauth2 v0.3.0
	golang.org/x/sync v0.1.0
	golang.org/x/time v0.0.0-20220609170525-579cf78fd858
	golang.org/x/tools v0.4.0
	gonum.org/v1/gonum v0.11.0
	google.golang.org/api v0.84.0
	google.golang.org/grpc v1.47.0
	google.golang.org/protobuf v1.28.1
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/ini.v1 v1.67.0
	gopkg.in/ldap.v3 v3.1.0
	gopkg.in/mail.v2 v2.3.1
	gopkg.in/square/go-jose.v2 v2.5.1
	gopkg.in/yaml.v2 v2.4.0
	gopkg.in/yaml.v3 v3.0.1
	xorm.io/builder v0.3.6
	xorm.io/core v0.7.3
	xorm.io/xorm v0.8.2
)

require (
	github.com/Azure/azure-sdk-for-go/sdk/internal v0.9.1 // indirect
	github.com/Azure/go-autorest v14.2.0+incompatible // indirect
	github.com/Azure/go-autorest/autorest/date v0.3.0 // indirect
	github.com/Azure/go-autorest/autorest/to v0.4.0 // indirect
	github.com/Azure/go-autorest/autorest/validation v0.3.1 // indirect
	github.com/Azure/go-autorest/logger v0.2.1 // indirect
	github.com/Azure/go-autorest/tracing v0.6.0 // indirect
	github.com/FZambia/eagle v0.0.2 // indirect
	github.com/FZambia/sentinel v1.1.0 // indirect
	github.com/alecthomas/units v0.0.0-20211218093645-b94a6e3cc137 // indirect
	github.com/andybalholm/brotli v1.0.4
	github.com/apache/arrow/go/arrow v0.0.0-20211112161151-bc219186db40 // indirect
	github.com/asaskevich/govalidator v0.0.0-20210307081110-f21760c49a8d // indirect
	github.com/beorn7/perks v1.0.1 // indirect
	github.com/cenkalti/backoff/v4 v4.2.0 // indirect
	github.com/centrifugal/protocol v0.8.10 // indirect
	github.com/cespare/xxhash/v2 v2.2.0 // indirect
	github.com/cheekybits/genny v1.0.0 // indirect
	github.com/cockroachdb/apd/v2 v2.0.2 // indirect
	github.com/deepmap/oapi-codegen v1.10.1
	github.com/dennwc/varint v1.0.0 // indirect
	github.com/dgryski/go-rendezvous v0.0.0-20200823014737-9f7001d12a5f // indirect
	github.com/docker/go-units v0.4.0 // indirect
	github.com/edsrzf/mmap-go v1.0.0 // indirect
	github.com/emicklei/proto v1.10.0 // indirect
	github.com/felixge/httpsnoop v1.0.2 // indirect
	github.com/go-kit/log v0.2.1
	github.com/go-logfmt/logfmt v0.5.1 // indirect
	github.com/go-openapi/analysis v0.21.4 // indirect
	github.com/go-openapi/errors v0.20.3 // indirect
	github.com/go-openapi/jsonpointer v0.19.5 // indirect
	github.com/go-openapi/jsonreference v0.20.0 // indirect
	github.com/go-openapi/loads v0.21.2
	github.com/go-openapi/runtime v0.25.0 // indirect
	github.com/go-openapi/spec v0.20.7 // indirect
	github.com/go-openapi/swag v0.22.3 // indirect
	github.com/go-openapi/validate v0.22.0 // indirect
	github.com/gogo/googleapis v1.4.1 // indirect
	github.com/gogo/status v1.1.0 // indirect
	github.com/golang-jwt/jwt/v4 v4.4.2 // indirect
	github.com/golang-sql/civil v0.0.0-20190719163853-cb61b32ac6fe // indirect
	github.com/golang/glog v1.0.0 // indirect
	github.com/golang/groupcache v0.0.0-20210331224755-41bb18bfe9da // indirect
	github.com/golang/protobuf v1.5.2
	github.com/gomodule/redigo v2.0.0+incompatible // indirect
	github.com/google/btree v1.0.1 // indirect
	github.com/google/flatbuffers v2.0.5+incompatible // indirect
	github.com/googleapis/gax-go/v2 v2.4.0
	github.com/gorilla/mux v1.8.0
	github.com/grafana/grafana-google-sdk-go v0.0.0-20211104130251-b190293eaf58
	github.com/grpc-ecosystem/go-grpc-prometheus v1.2.1-0.20191002090509-6af20e3a5340 // indirect
	github.com/hashicorp/errwrap v1.1.0 // indirect
	github.com/hashicorp/go-msgpack v0.5.5 // indirect
	github.com/hashicorp/go-multierror v1.1.1
	github.com/hashicorp/go-sockaddr v1.0.2 // indirect
	github.com/hashicorp/golang-lru v0.5.4 // indirect
	github.com/hashicorp/yamux v0.0.0-20210826001029-26ff87cf9493 // indirect
	github.com/igm/sockjs-go/v3 v3.0.2 // indirect
	github.com/jessevdk/go-flags v1.5.0 // indirect
	github.com/jonboulle/clockwork v0.3.0 // indirect
	github.com/josharian/intern v1.0.0 // indirect
	github.com/jpillora/backoff v1.0.0 // indirect
	github.com/mailru/easyjson v0.7.7 // indirect
	github.com/mattermost/xml-roundtrip-validator v0.1.0 // indirect
	github.com/mattetti/filebuffer v1.0.1 // indirect
	github.com/mattn/go-runewidth v0.0.13 // indirect
	github.com/miekg/dns v1.1.49 // indirect
	github.com/mitchellh/go-testing-interface v1.14.0 // indirect
	github.com/mna/redisc v1.3.2 // indirect
	github.com/modern-go/concurrent v0.0.0-20180306012644-bacd9c7ef1dd // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/mpvl/unique v0.0.0-20150818121801-cbe035fff7de // indirect
	github.com/oklog/run v1.1.0 // indirect
	github.com/oklog/ulid v1.3.1 // indirect
	github.com/olekukonko/tablewriter v0.0.5 // indirect
	github.com/opentracing-contrib/go-grpc v0.0.0-20210225150812-73cb765af46e // indirect
	github.com/opentracing-contrib/go-stdlib v1.0.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/prometheus/common/sigv4 v0.1.0 // indirect
	github.com/prometheus/exporter-toolkit v0.8.2 // indirect
	github.com/prometheus/node_exporter v1.0.0-rc.0.0.20200428091818-01054558c289 // indirect
	github.com/prometheus/procfs v0.8.0 // indirect
	github.com/protocolbuffers/txtpbfmt v0.0.0-20220428173112-74888fd59c2b // indirect
	github.com/rs/cors v1.8.3 // indirect
	github.com/sean-/seed v0.0.0-20170313163322-e2103e2c3529 // indirect
	github.com/segmentio/encoding v0.3.5
	github.com/sercand/kuberesolver v2.4.0+incompatible // indirect
	github.com/sergi/go-diff v1.1.0 // indirect
	github.com/shurcooL/httpfs v0.0.0-20190707220628-8d4bc4ba7749 // indirect
	github.com/shurcooL/vfsgen v0.0.0-20200824052919-0d455de96546 // indirect
	github.com/sirupsen/logrus v1.9.0 // indirect
	github.com/stretchr/objx v0.5.0 // indirect
	github.com/uber/jaeger-lib v2.4.1+incompatible // indirect
	github.com/valyala/bytebufferpool v1.0.0 // indirect
	github.com/weaveworks/promrus v1.2.0 // indirect
	github.com/yudai/golcs v0.0.0-20170316035057-ecda9a501e82 // indirect
	go.mongodb.org/mongo-driver v1.11.0 // indirect
	go.opencensus.io v0.23.0 // indirect
	go.uber.org/atomic v1.10.0
	go.uber.org/goleak v1.1.12 // indirect
	golang.org/x/sys v0.3.0 // indirect
	golang.org/x/text v0.5.0
	golang.org/x/xerrors v0.0.0-20220609144429-65e65417b02f // indirect
	google.golang.org/appengine v1.6.7 // indirect
	google.golang.org/genproto v0.0.0-20220708155623-50e5f4832e73
	gopkg.in/asn1-ber.v1 v1.0.0-20181015200546-f715ec2f112d // indirect
)

require (
	cloud.google.com/go/kms v1.4.0
	github.com/Azure/azure-sdk-for-go/sdk/azidentity v0.13.2
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/azkeys v0.4.0
	github.com/Azure/azure-storage-blob-go v0.15.0
	github.com/Azure/go-autorest/autorest/adal v0.9.20
	github.com/Masterminds/semver/v3 v3.1.1
	github.com/armon/go-radix v1.0.0
	github.com/blugelabs/bluge v0.1.9
	github.com/blugelabs/bluge_segment_api v0.2.0
	github.com/bufbuild/connect-go v1.0.0
	github.com/dlmiddlecote/sqlstats v1.0.2
	github.com/docker/docker v20.10.16+incompatible
	github.com/drone/drone-cli v1.6.1
	github.com/getkin/kin-openapi v0.103.0
	github.com/golang-migrate/migrate/v4 v4.7.0
	github.com/google/go-github/v45 v45.2.0
	github.com/grafana/codejen v0.0.2
	github.com/grafana/dskit v0.0.0-20211011144203-3a88ec0b675f
	github.com/jmoiron/sqlx v1.3.5
	github.com/matryer/is v1.4.0
	github.com/parca-dev/parca v0.12.1
	github.com/urfave/cli v1.22.9
	go.etcd.io/etcd/api/v3 v3.5.4
	go.opentelemetry.io/contrib/instrumentation/google.golang.org/grpc/otelgrpc v0.32.0
	go.opentelemetry.io/contrib/propagators/jaeger v1.6.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace v1.7.0
	go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc v1.7.0
	gocloud.dev v0.25.0
)

require (
	cloud.google.com/go v0.102.0 // indirect
	github.com/Azure/azure-pipeline-go v0.2.3 // indirect
	github.com/armon/go-metrics v0.3.10 // indirect
	github.com/bmatcuk/doublestar v1.1.1 // indirect
	github.com/buildkite/yaml v2.1.0+incompatible // indirect
	github.com/containerd/containerd v1.6.8 // indirect
	github.com/coreos/go-systemd/v22 v22.4.0 // indirect
	github.com/cpuguy83/go-md2man/v2 v2.0.2 // indirect
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/docker/distribution v2.8.1+incompatible // indirect
	github.com/docker/go-connections v0.4.0 // indirect
	github.com/drone-runners/drone-runner-docker v1.8.2 // indirect
	github.com/drone/drone-go v1.7.1 // indirect
	github.com/drone/envsubst v1.0.3 // indirect
	github.com/drone/runner-go v1.12.0 // indirect
	github.com/go-ozzo/ozzo-validation/v4 v4.3.0 // indirect
	github.com/google/go-querystring v1.1.0 // indirect
	github.com/googleapis/enterprise-certificate-proxy v0.0.0-20220520183353-fd19c99a87aa // indirect
	github.com/googleapis/go-type-adapters v1.0.0 // indirect
	github.com/gosimple/unidecode v1.0.1 // indirect
	github.com/hashicorp/go-immutable-radix v1.3.1 // indirect
	github.com/hashicorp/golang-lru/v2 v2.0.1 // indirect
	github.com/hashicorp/memberlist v0.5.0 // indirect
	github.com/invopop/yaml v0.1.0 // indirect
	github.com/kr/text v0.2.0 // indirect
	github.com/mattn/go-colorable v0.1.12 // indirect
	github.com/mattn/go-ieproxy v0.0.3 // indirect
	github.com/mitchellh/mapstructure v1.5.0 // indirect
	github.com/opencontainers/go-digest v1.0.0 // indirect
	github.com/opencontainers/image-spec v1.0.3-0.20211202183452-c5a74bcca799 // indirect
	github.com/rivo/uniseg v0.2.0 // indirect
	github.com/russross/blackfriday/v2 v2.1.0 // indirect
	github.com/segmentio/asm v1.1.4 // indirect
	go.starlark.net v0.0.0-20221020143700-22309ac47eac // indirect
)

require (
	cloud.google.com/go/compute v1.7.0 // indirect
	cloud.google.com/go/iam v0.3.0 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/azcore v0.22.0 // indirect
	github.com/Azure/azure-sdk-for-go/sdk/keyvault/internal v0.2.1 // indirect
	github.com/AzureAD/microsoft-authentication-library-for-go v0.4.0 // indirect
	github.com/Microsoft/go-winio v0.5.2 // indirect
	github.com/ProtonMail/go-crypto v0.0.0-20210428141323-04723f9f07d7 // indirect
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
	github.com/coreos/go-semver v0.3.0 // indirect
	github.com/dgryski/go-metro v0.0.0-20211217172704-adc40b04c140 // indirect
	github.com/elazarl/goproxy v0.0.0-20220115173737-adb46da277ac // indirect
	github.com/emirpasic/gods v1.12.0 // indirect
	github.com/ghodss/yaml v1.0.1-0.20190212211648-25d852aebe32 // indirect
	github.com/go-git/gcfg v1.5.0 // indirect
	github.com/go-git/go-billy/v5 v5.3.1 // indirect
	github.com/go-logr/logr v1.2.3 // indirect
	github.com/go-logr/stdr v1.2.2 // indirect
	github.com/golang-jwt/jwt v3.2.2+incompatible // indirect
	github.com/google/go-github v17.0.0+incompatible
	github.com/grpc-ecosystem/grpc-gateway/v2 v2.10.3 // indirect
	github.com/imdario/mergo v0.3.12 // indirect
	github.com/jbenet/go-context v0.0.0-20150711004518-d14ea06fba99 // indirect
	github.com/kevinburke/ssh_config v0.0.0-20201106050909-4977a11b4351 // indirect
	github.com/klauspost/compress v1.15.5 // indirect
	github.com/kylelemons/godebug v1.1.0 // indirect
	github.com/labstack/echo/v4 v4.9.0 // indirect
	github.com/labstack/gommon v0.3.1 // indirect
	github.com/mitchellh/go-homedir v1.1.0 // indirect
	github.com/mitchellh/go-wordwrap v1.0.1 // indirect
	github.com/mschoch/smat v0.2.0 // indirect
	github.com/pierrec/lz4/v4 v4.1.12 // indirect
	github.com/valyala/fasttemplate v1.2.1 // indirect
	github.com/wk8/go-ordered-map v1.0.0
	github.com/xanzy/ssh-agent v0.3.0 // indirect
	github.com/xlab/treeprint v1.1.0 // indirect
	github.com/yudai/pp v2.0.1+incompatible // indirect
	go.opentelemetry.io/otel/exporters/otlp/internal/retry v1.7.0 // indirect
	go.opentelemetry.io/proto/otlp v0.16.0 // indirect
	golang.org/x/mod v0.7.0 // indirect
	gopkg.in/warnings.v0 v0.1.2 // indirect
)

// Use fork of crewjam/saml with fixes for some issues until changes get merged into upstream
replace github.com/crewjam/saml => github.com/grafana/saml v0.4.9-0.20230102094056-b61b9eb7c8b7

replace github.com/apache/thrift => github.com/apache/thrift v0.14.1

replace github.com/hashicorp/consul => github.com/hashicorp/consul v1.10.2

replace github.com/gin-gonic/gin => github.com/gin-gonic/gin v1.7.7

replace github.com/tidwall/gjson => github.com/tidwall/gjson v1.14.1

// Upgraded to fix CVE-2020-26066. This can be removed when go.opentelemetry.io/collector and github.com/influxdata/telegraf are upgraded
// github.com/tidwall/match v1.0.1 should not be used.
replace github.com/tidwall/match => github.com/tidwall/match v1.1.1

// Thema's thema CLI requires cobra, which eventually works its way down to go-hclog@v1.0.0.
// Upgrading affects backend plugins: https://github.com/grafana/grafana/pull/47653#discussion_r850508593
// No harm to Thema because it's only a dependency in its main package.
replace github.com/hashicorp/go-hclog => github.com/hashicorp/go-hclog v0.16.1

replace github.com/microcosm-cc/bluemonday => github.com/microcosm-cc/bluemonday v1.0.18

// This is a patched v0.8.2 intended to fix session.Find (and others) silently ignoring SQLITE_BUSY errors. This could
// happen, for example, during a read when the sqlite db is under heavy write load.
// This patch cherry picks compatible fixes from upstream xorm PR#1998 and can be reverted on upgrade to xorm v1.2.0+.
replace xorm.io/xorm => github.com/grafana/xorm v0.8.3-0.20220614223926-2fcda7565af6

// Use our fork of the upstream alertmanagers.
// This is required in order to get notification delivery errors from the receivers API.
replace github.com/prometheus/alertmanager => github.com/grafana/prometheus-alertmanager v0.25.1-0.20230315093259-b399710c2887

// grpc v1.46.0 removed "WithBalancerName()" API, still in use by weaveworks/commons.
replace google.golang.org/grpc => google.golang.org/grpc v1.45.0

replace google.golang.org/genproto => google.golang.org/genproto v0.0.0-20220421151946-72621c1f0bd3
