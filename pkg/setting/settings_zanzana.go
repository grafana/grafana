package setting

import (
	"slices"
	"time"
)

type ZanzanaMode string

const (
	ZanzanaModeClient   ZanzanaMode = "client"
	ZanzanaModeEmbedded ZanzanaMode = "embedded"
)

type ZanzanaClientSettings struct {
	// Mode can either be embedded or client.
	Mode ZanzanaMode
	// Addr is the address of the Zanzana server.
	// Only used when mode is set to client.
	Addr string
	// Certificate used to authenticate the Server
	// Only used when mode is set to client
	ServerCertFile string
	// Token used to perform the exchange request.
	// Only used when mode is set to client.
	Token string
	// URL called to perform exchange request.
	// Only used when mode is set to client.
	TokenExchangeURL string
}

type ZanzanaServerSettings struct {
	// OpenFGA http server address which allows to connect with fga cli.
	// Can only be used in dev mode.
	OpenFGAHttpAddr string
	// Enable cache for Check() requests
	CheckQueryCache bool
	// TTL for cached requests. Default is 10 seconds.
	CheckQueryCacheTTL time.Duration
	// Max number of results returned by ListObjects() query. Default is 1000.
	ListObjectsMaxResults uint32
	// Deadline for the ListObjects() query. Default is 3 seconds.
	ListObjectsDeadline time.Duration
	// Use streamed version of list objects.
	// Returns full list of objects, but takes more time.
	UseStreamedListObjects bool
	// URL for fetching signing keys.
	SigningKeysURL string
}

func (cfg *Cfg) readZanzanaSettings() {
	zc := ZanzanaClientSettings{}
	clientSec := cfg.Raw.Section("zanzana.client")

	zc.Mode = ZanzanaMode(clientSec.Key("mode").MustString("embedded"))
	validModes := []ZanzanaMode{ZanzanaModeEmbedded, ZanzanaModeClient}

	if !slices.Contains(validModes, zc.Mode) {
		cfg.Logger.Warn("Invalid zanzana mode", "expected", validModes, "got", zc.Mode)
		zc.Mode = "embedded"
	}

	zc.Token = clientSec.Key("token").MustString("")
	zc.TokenExchangeURL = clientSec.Key("token_exchange_url").MustString("")
	zc.Addr = clientSec.Key("address").MustString("")

	cfg.ZanzanaClient = zc

	zs := ZanzanaServerSettings{}
	serverSec := cfg.Raw.Section("zanzana.server")

	zs.OpenFGAHttpAddr = serverSec.Key("http_addr").MustString("127.0.0.1:8080")
	zs.CheckQueryCache = serverSec.Key("check_query_cache").MustBool(true)
	zs.CheckQueryCacheTTL = serverSec.Key("check_query_cache_ttl").MustDuration(10 * time.Second)
	zs.ListObjectsDeadline = serverSec.Key("list_objects_deadline").MustDuration(3 * time.Second)
	zs.ListObjectsMaxResults = uint32(serverSec.Key("list_objects_max_results").MustUint(1000))
	zs.UseStreamedListObjects = serverSec.Key("use_streamed_list_objects").MustBool(false)
	zs.SigningKeysURL = serverSec.Key("signing_keys_url").MustString("")

	cfg.ZanzanaServer = zs
}
