module github.com/grafana/grafana

go 1.14

require (
	github.com/BurntSushi/toml v0.3.1
	github.com/VividCortex/mysqlerr v0.0.0-20170204212430-6c6b55f8796f
	github.com/aws/aws-sdk-go v1.29.20
	github.com/beevik/etree v1.1.0 // indirect
	github.com/benbjohnson/clock v0.0.0-20161215174838-7dc76406b6d3
	github.com/bradfitz/gomemcache v0.0.0-20190329173943-551aad21a668
	github.com/codahale/hdrhistogram v0.0.0-20161010025455-3a0bb77429bd // indirect
	github.com/crewjam/saml v0.0.0-20191031171751-c42136edf9b1
	github.com/davecgh/go-spew v1.1.1
	github.com/denisenkom/go-mssqldb v0.0.0-20190707035753-2be1aa521ff4
	github.com/facebookgo/ensure v0.0.0-20160127193407-b4ab57deab51 // indirect
	github.com/facebookgo/inject v0.0.0-20180706035515-f23751cae28b
	github.com/facebookgo/stack v0.0.0-20160209184415-751773369052 // indirect
	github.com/facebookgo/structtag v0.0.0-20150214074306-217e25fb9691 // indirect
	github.com/facebookgo/subset v0.0.0-20150612182917-8dac2c3c4870 // indirect
	github.com/fatih/color v1.7.0
	github.com/go-macaron/binding v0.0.0-20190806013118-0b4f37bab25b
	github.com/go-macaron/gzip v0.0.0-20160222043647-cad1c6580a07
	github.com/go-macaron/session v0.0.0-20190805070824-1a3cdc6f5659
	github.com/go-sql-driver/mysql v1.5.0
	github.com/go-stack/stack v1.8.0
	github.com/gobwas/glob v0.2.3
	github.com/golang/protobuf v1.4.0
	github.com/google/go-cmp v0.4.0
	github.com/gorilla/websocket v1.4.1
	github.com/gosimple/slug v1.4.2
	github.com/grafana/grafana-plugin-model v0.0.0-20190930120109-1fc953a61fb4
	github.com/grafana/grafana-plugin-sdk-go v0.75.0
	github.com/hashicorp/go-hclog v0.0.0-20180709165350-ff2cf002a8dd
	github.com/hashicorp/go-plugin v1.2.2
	github.com/hashicorp/go-version v1.1.0
	github.com/inconshreveable/log15 v0.0.0-20180818164646-67afb5ed74ec
	github.com/influxdata/influxdb-client-go v1.3.0
	github.com/jmespath/go-jmespath v0.0.0-20180206201540-c2b33e8439af
	github.com/jung-kurt/gofpdf v1.10.1
	github.com/k0kubun/colorstring v0.0.0-20150214042306-9440f1994b88 // indirect
	github.com/klauspost/compress v1.4.1 // indirect
	github.com/klauspost/cpuid v1.2.0 // indirect
	github.com/lib/pq v1.2.0
	github.com/linkedin/goavro/v2 v2.9.7
	github.com/mattn/go-colorable v0.1.6 // indirect
	github.com/mattn/go-isatty v0.0.12
	github.com/mattn/go-sqlite3 v1.11.0
	github.com/opentracing/opentracing-go v1.1.0
	github.com/patrickmn/go-cache v2.1.0+incompatible
	github.com/pkg/errors v0.9.1
	github.com/prometheus/client_golang v1.3.0
	github.com/prometheus/client_model v0.1.0
	github.com/prometheus/common v0.7.0
	github.com/rainycape/unidecode v0.0.0-20150907023854-cb7f23ec59be // indirect
	github.com/robfig/cron v0.0.0-20180505203441-b41be1df6967
	github.com/robfig/cron/v3 v3.0.0
	github.com/sergi/go-diff v1.0.0 // indirect
	github.com/smartystreets/goconvey v0.0.0-20190731233626-505e41936337
	github.com/stretchr/testify v1.5.1
	github.com/teris-io/shortid v0.0.0-20171029131806-771a37caa5cf
	github.com/timberio/go-datemath v0.1.1-0.20200323150745-74ddef604fff
	github.com/ua-parser/uap-go v0.0.0-20190826212731-daf92ba38329
	github.com/uber/jaeger-client-go v2.24.0+incompatible
	github.com/uber/jaeger-lib v2.2.0+incompatible // indirect
	github.com/unknwon/com v1.0.1
	github.com/urfave/cli/v2 v2.1.1
	github.com/xorcare/pointer v1.1.0
	github.com/yudai/gojsondiff v1.0.0
	github.com/yudai/golcs v0.0.0-20170316035057-ecda9a501e82 // indirect
	github.com/yudai/pp v2.0.1+incompatible // indirect
	go.uber.org/atomic v1.5.1 // indirect
	golang.org/x/crypto v0.0.0-20200406173513-056763e48d71
	golang.org/x/net v0.0.0-20200501053045-e0ff5e5a1de5
	golang.org/x/oauth2 v0.0.0-20200107190931-bf48bf16ab8d
	golang.org/x/sync v0.0.0-20200317015054-43a5402ce75a
	golang.org/x/xerrors v0.0.0-20191204190536-9bdfabe68543
	google.golang.org/grpc v1.29.1
	gopkg.in/alexcesaro/quotedprintable.v3 v3.0.0-20150716171945-2caba252f4dc // indirect
	gopkg.in/asn1-ber.v1 v1.0.0-20181015200546-f715ec2f112d // indirect
	gopkg.in/ini.v1 v1.46.0
	gopkg.in/ldap.v3 v3.0.2
	gopkg.in/macaron.v1 v1.3.9
	gopkg.in/mail.v2 v2.3.1
	gopkg.in/redis.v5 v5.2.9
	gopkg.in/square/go-jose.v2 v2.4.1
	gopkg.in/yaml.v2 v2.2.8
	xorm.io/core v0.7.3
	xorm.io/xorm v0.8.1
)
