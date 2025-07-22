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
	// Cache settings
	CacheSettings OpenFgaCacheSettings
	// Max number of results returned by ListObjects() query. Default is 1000.
	ListObjectsMaxResults uint32
	// Deadline for the ListObjects() query. Default is 3 seconds.
	ListObjectsDeadline time.Duration
	// Use streamed version of list objects.
	// Returns full list of objects, but takes more time.
	UseStreamedListObjects bool
	// URL for fetching signing keys.
	SigningKeysURL string
	// Allow insecure connections to the server for development purposes.
	AllowInsecure bool
}

// Parameters to configure OpenFGA cache.
type OpenFgaCacheSettings struct {
	// Number of items that will be kept in the in-memory cache used to resolve Check queries.
	// If CheckQueryCacheEnabled or CheckIteratorCacheEnabled, this is the size limit of the cache
	CheckCacheLimit uint32
	// When enabled, cache controller will verify whether check subproblem cache and check
	// iterator cache needs to be invalidated when there is a check or list objects API request.
	// The invalidation determination is based on whether there are recent write or deletes for
	// the store. This feature allows a larger check-query-cache-ttl and check-iterator-cache-ttl
	// at the expense of additional datastore queries for recent writes and deletes.
	CacheControllerEnabled bool
	// Specifies how frequently the cache controller checks for Writes occurring. While the
	// cache controller result is cached, the server will not read the datastore to check
	// whether subproblem cache and iterator cache needs to be invalidated.
	CacheControllerTTL time.Duration
	// Enables in-memory caching of Check subproblems. For example, if you have a relation
	// `define viewer: owner or editor`, and the query is `Check(user:anne, viewer, doc:1)`,
	// we'll evaluate the `owner` relation and the `editor` relation and cache both results:
	// `(user:anne, viewer, doc:1) -> allowed=true` and `(user:anne, owner, doc:1) -> allowed=true`.
	CheckQueryCacheEnabled bool
	// Time that items will be kept in the cache of Check subproblems
	CheckQueryCacheTTL time.Duration
	// Enables in-memory caching of database iterators. Each iterator is the result of a database
	// query, for example, usersets related to a specific object, or objects related to a specific
	// user, up to a certain number of tuples per iterator
	CheckIteratorCacheEnabled bool
	// Number of tuples that will be stored for each database iterator
	CheckIteratorCacheMaxResults uint32
	// Time that items will be kept in the cache of database iterators
	CheckIteratorCacheTTL time.Duration
	// Enables in-memory caching of database iterators for ListObjects. Each iterator is the result
	// of a database query, for example, usersets related to a specific object, or objects related
	// to a specific user, up to a certain number of tuples per iterator
	ListObjectsIteratorCacheEnabled bool
	// Number of tuples that will be stored for each ListObjects database iterator
	ListObjectsIteratorCacheMaxResults uint32
	// Time that items will be kept in the cache of ListObjects database iterators
	ListObjectsIteratorCacheTTL time.Duration
	// Enables sharing of datastore iterators with different consumers. Each iterator is the result
	// of a database query, for example usersets related to a specific object, or objects related
	// to a specific user, up to a certain number of tuples per iterator
	SharedIteratorEnabled bool
	// Limit of the number of iterators that can be shared when shared iterator is enabled
	SharedIteratorLimit uint32
	// Time that shared iterators will be kept in the cache
	SharedIteratorTTL time.Duration
}

func (cfg *Cfg) readZanzanaSettings() {
	zc := ZanzanaClientSettings{}
	clientSec := cfg.SectionWithEnvOverrides("zanzana.client")

	zc.Mode = ZanzanaMode(clientSec.Key("mode").MustString("embedded"))
	validModes := []ZanzanaMode{ZanzanaModeEmbedded, ZanzanaModeClient}

	if !slices.Contains(validModes, zc.Mode) {
		cfg.Logger.Warn("Invalid zanzana mode", "expected", validModes, "got", zc.Mode)
		zc.Mode = "embedded"
	}

	zc.Token = clientSec.Key("token").MustString("")
	zc.TokenExchangeURL = clientSec.Key("token_exchange_url").MustString("")
	zc.Addr = clientSec.Key("address").MustString("")
	zc.ServerCertFile = clientSec.Key("tls_cert").MustString("")

	cfg.ZanzanaClient = zc

	zs := ZanzanaServerSettings{}
	serverSec := cfg.SectionWithEnvOverrides("zanzana.server")

	zs.OpenFGAHttpAddr = serverSec.Key("http_addr").MustString("127.0.0.1:8080")
	zs.ListObjectsDeadline = serverSec.Key("list_objects_deadline").MustDuration(3 * time.Second)
	zs.ListObjectsMaxResults = uint32(serverSec.Key("list_objects_max_results").MustUint(1000))
	zs.UseStreamedListObjects = serverSec.Key("use_streamed_list_objects").MustBool(false)
	zs.SigningKeysURL = serverSec.Key("signing_keys_url").MustString("")
	zs.AllowInsecure = serverSec.Key("allow_insecure").MustBool(false)

	// Cache settings
	zs.CacheSettings.CheckCacheLimit = uint32(serverSec.Key("check_cache_limit").MustUint(10000))
	zs.CacheSettings.CacheControllerEnabled = serverSec.Key("cache_controller_enabled").MustBool(false)
	zs.CacheSettings.CacheControllerTTL = serverSec.Key("cache_controller_ttl").MustDuration(10 * time.Second)
	zs.CacheSettings.CheckQueryCacheEnabled = serverSec.Key("check_query_cache_enabled").MustBool(true)
	zs.CacheSettings.CheckQueryCacheTTL = serverSec.Key("check_query_cache_ttl").MustDuration(10 * time.Second)
	zs.CacheSettings.CheckIteratorCacheEnabled = serverSec.Key("check_iterator_cache_enabled").MustBool(false)
	zs.CacheSettings.CheckIteratorCacheMaxResults = uint32(serverSec.Key("check_iterator_cache_max_results").MustUint(1000))
	zs.CacheSettings.CheckIteratorCacheTTL = serverSec.Key("check_iterator_cache_ttl").MustDuration(10 * time.Second)
	zs.CacheSettings.ListObjectsIteratorCacheEnabled = serverSec.Key("list_objects_iterator_cache_enabled").MustBool(false)
	zs.CacheSettings.ListObjectsIteratorCacheMaxResults = uint32(serverSec.Key("list_objects_iterator_cache_max_results").MustUint(1000))
	zs.CacheSettings.ListObjectsIteratorCacheTTL = serverSec.Key("list_objects_iterator_cache_ttl").MustDuration(10 * time.Second)
	zs.CacheSettings.SharedIteratorEnabled = serverSec.Key("shared_iterator_enabled").MustBool(false)
	zs.CacheSettings.SharedIteratorLimit = uint32(serverSec.Key("shared_iterator_limit").MustUint(1000))
	zs.CacheSettings.SharedIteratorTTL = serverSec.Key("shared_iterator_ttl").MustDuration(10 * time.Second)

	cfg.ZanzanaServer = zs
}
