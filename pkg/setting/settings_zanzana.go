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
	// Namespace to use for the token.
	TokenNamespace string
}

type ZanzanaServerSettings struct {
	// OpenFGA http server address which allows to connect with fga cli.
	// Can only be used in dev mode.
	OpenFGAHttpAddr string
	// Cache settings
	CacheSettings OpenFgaCacheSettings
	// OpenFGA server settings
	OpenFgaServerSettings OpenFgaServerSettings
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

type OpenFgaServerSettings struct {
	// ListObjects settings
	// Max number of concurrent datastore reads for ListObjects queries
	MaxConcurrentReadsForListObjects uint32
	// Enable dispatch throttling for ListObjects queries
	ListObjectsDispatchThrottlingEnabled bool
	// Frequency for dispatch throttling in ListObjects queries
	ListObjectsDispatchThrottlingFrequency time.Duration
	// Threshold for dispatch throttling in ListObjects queries
	ListObjectsDispatchThrottlingThreshold uint32
	// Max threshold for dispatch throttling in ListObjects queries
	ListObjectsDispatchThrottlingMaxThreshold uint32
	// Database throttle threshold for ListObjects queries
	ListObjectsDatabaseThrottleThreshold int
	// Database throttle duration for ListObjects queries
	ListObjectsDatabaseThrottleDuration time.Duration

	// ListUsers settings
	// Deadline for ListUsers queries
	ListUsersDeadline time.Duration
	// Max number of results returned by ListUsers queries
	ListUsersMaxResults uint32
	// Max number of concurrent datastore reads for ListUsers queries
	MaxConcurrentReadsForListUsers uint32
	// Enable dispatch throttling for ListUsers queries
	ListUsersDispatchThrottlingEnabled bool
	// Frequency for dispatch throttling in ListUsers queries
	ListUsersDispatchThrottlingFrequency time.Duration
	// Threshold for dispatch throttling in ListUsers queries
	ListUsersDispatchThrottlingThreshold uint32
	// Max threshold for dispatch throttling in ListUsers queries
	ListUsersDispatchThrottlingMaxThreshold uint32
	// Database throttle threshold for ListUsers queries
	ListUsersDatabaseThrottleThreshold int
	// Database throttle duration for ListUsers queries
	ListUsersDatabaseThrottleDuration time.Duration

	// Check settings
	// Max number of concurrent datastore reads for Check queries
	MaxConcurrentReadsForCheck uint32
	// Database throttle threshold for Check queries
	CheckDatabaseThrottleThreshold int
	// Database throttle duration for Check queries
	CheckDatabaseThrottleDuration time.Duration

	// Batch check settings
	// Max number of concurrent checks per batch check request
	MaxConcurrentChecksPerBatchCheck uint32
	// Max number of checks per batch check request
	MaxChecksPerBatchCheck uint32

	// Resolve node settings
	// Max number of nodes that can be resolved in a single query
	ResolveNodeLimit uint32
	// Max breadth of nodes that can be resolved in a single query
	ResolveNodeBreadthLimit uint32

	// Dispatch throttling settings for Check resolver
	// Enable dispatch throttling for Check resolver
	DispatchThrottlingCheckResolverEnabled bool
	// Frequency for dispatch throttling in Check resolver
	DispatchThrottlingCheckResolverFrequency time.Duration
	// Threshold for dispatch throttling in Check resolver
	DispatchThrottlingCheckResolverThreshold uint32
	// Max threshold for dispatch throttling in Check resolver
	DispatchThrottlingCheckResolverMaxThreshold uint32

	// Shadow check/query settings
	// Timeout for shadow check resolver
	ShadowCheckResolverTimeout time.Duration
	// Timeout for shadow ListObjects query
	ShadowListObjectsQueryTimeout time.Duration
	// Max delta items for shadow ListObjects query
	ShadowListObjectsQueryMaxDeltaItems int

	// Request settings
	// Global request timeout
	RequestTimeout time.Duration
	// Max size in bytes for authorization model
	MaxAuthorizationModelSizeInBytes int
	// Size of the authorization model cache
	AuthorizationModelCacheSize int
	// Offset for changelog horizon
	ChangelogHorizonOffset int
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

	zc.Addr = clientSec.Key("address").MustString("")
	zc.ServerCertFile = clientSec.Key("tls_cert").MustString("")

	grpcClientAuthSection := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	zc.Token = grpcClientAuthSection.Key("token").MustString("")
	zc.TokenExchangeURL = grpcClientAuthSection.Key("token_exchange_url").MustString("")
	zc.TokenNamespace = grpcClientAuthSection.Key("token_namespace").MustString("stacks-" + cfg.StackID)

	// TODO: remove old settings when migrated
	token := clientSec.Key("token").MustString("")
	tokenExchangeURL := clientSec.Key("token_exchange_url").MustString("")
	if token != "" {
		zc.Token = token
	}
	if tokenExchangeURL != "" {
		zc.TokenExchangeURL = tokenExchangeURL
	}

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

	openfgaSec := cfg.SectionWithEnvOverrides("openfga")

	// ListObjects settings
	zs.OpenFgaServerSettings.MaxConcurrentReadsForListObjects = uint32(openfgaSec.Key("max_concurrent_reads_for_list_objects").MustUint(0))
	zs.OpenFgaServerSettings.ListObjectsDispatchThrottlingEnabled = openfgaSec.Key("list_objects_dispatch_throttling_enabled").MustBool(false)
	zs.OpenFgaServerSettings.ListObjectsDispatchThrottlingFrequency = openfgaSec.Key("list_objects_dispatch_throttling_frequency").MustDuration(0)
	zs.OpenFgaServerSettings.ListObjectsDispatchThrottlingThreshold = uint32(openfgaSec.Key("list_objects_dispatch_throttling_threshold").MustUint(0))
	zs.OpenFgaServerSettings.ListObjectsDispatchThrottlingMaxThreshold = uint32(openfgaSec.Key("list_objects_dispatch_throttling_max_threshold").MustUint(0))
	zs.OpenFgaServerSettings.ListObjectsDatabaseThrottleThreshold = openfgaSec.Key("list_objects_database_throttle_threshold").MustInt(0)
	zs.OpenFgaServerSettings.ListObjectsDatabaseThrottleDuration = openfgaSec.Key("list_objects_database_throttle_duration").MustDuration(0)

	// ListUsers settings
	zs.OpenFgaServerSettings.ListUsersDeadline = openfgaSec.Key("list_users_deadline").MustDuration(0)
	zs.OpenFgaServerSettings.ListUsersMaxResults = uint32(openfgaSec.Key("list_users_max_results").MustUint(0))
	zs.OpenFgaServerSettings.MaxConcurrentReadsForListUsers = uint32(openfgaSec.Key("max_concurrent_reads_for_list_users").MustUint(0))
	zs.OpenFgaServerSettings.ListUsersDispatchThrottlingEnabled = openfgaSec.Key("list_users_dispatch_throttling_enabled").MustBool(false)
	zs.OpenFgaServerSettings.ListUsersDispatchThrottlingFrequency = openfgaSec.Key("list_users_dispatch_throttling_frequency").MustDuration(0)
	zs.OpenFgaServerSettings.ListUsersDispatchThrottlingThreshold = uint32(openfgaSec.Key("list_users_dispatch_throttling_threshold").MustUint(0))
	zs.OpenFgaServerSettings.ListUsersDispatchThrottlingMaxThreshold = uint32(openfgaSec.Key("list_users_dispatch_throttling_max_threshold").MustUint(0))
	zs.OpenFgaServerSettings.ListUsersDatabaseThrottleThreshold = openfgaSec.Key("list_users_database_throttle_threshold").MustInt(0)
	zs.OpenFgaServerSettings.ListUsersDatabaseThrottleDuration = openfgaSec.Key("list_users_database_throttle_duration").MustDuration(0)

	// Check settings
	zs.OpenFgaServerSettings.MaxConcurrentReadsForCheck = uint32(openfgaSec.Key("max_concurrent_reads_for_check").MustUint(0))
	zs.OpenFgaServerSettings.CheckDatabaseThrottleThreshold = openfgaSec.Key("check_database_throttle_threshold").MustInt(0)
	zs.OpenFgaServerSettings.CheckDatabaseThrottleDuration = openfgaSec.Key("check_database_throttle_duration").MustDuration(0)

	// Batch check settings
	zs.OpenFgaServerSettings.MaxConcurrentChecksPerBatchCheck = uint32(openfgaSec.Key("max_concurrent_checks_per_batch_check").MustUint(0))
	zs.OpenFgaServerSettings.MaxChecksPerBatchCheck = uint32(openfgaSec.Key("max_checks_per_batch_check").MustUint(0))

	// Resolve node settings
	zs.OpenFgaServerSettings.ResolveNodeLimit = uint32(openfgaSec.Key("resolve_node_limit").MustUint(0))
	zs.OpenFgaServerSettings.ResolveNodeBreadthLimit = uint32(openfgaSec.Key("resolve_node_breadth_limit").MustUint(0))

	// Dispatch throttling settings for Check resolver
	zs.OpenFgaServerSettings.DispatchThrottlingCheckResolverEnabled = openfgaSec.Key("dispatch_throttling_check_resolver_enabled").MustBool(false)
	zs.OpenFgaServerSettings.DispatchThrottlingCheckResolverFrequency = openfgaSec.Key("dispatch_throttling_check_resolver_frequency").MustDuration(0)
	zs.OpenFgaServerSettings.DispatchThrottlingCheckResolverThreshold = uint32(openfgaSec.Key("dispatch_throttling_check_resolver_threshold").MustUint(0))
	zs.OpenFgaServerSettings.DispatchThrottlingCheckResolverMaxThreshold = uint32(openfgaSec.Key("dispatch_throttling_check_resolver_max_threshold").MustUint(0))

	// Shadow check/query settings
	zs.OpenFgaServerSettings.ShadowCheckResolverTimeout = openfgaSec.Key("shadow_check_resolver_timeout").MustDuration(0)
	zs.OpenFgaServerSettings.ShadowListObjectsQueryTimeout = openfgaSec.Key("shadow_list_objects_query_timeout").MustDuration(0)
	zs.OpenFgaServerSettings.ShadowListObjectsQueryMaxDeltaItems = openfgaSec.Key("shadow_list_objects_query_max_delta_items").MustInt(0)

	zs.OpenFgaServerSettings.RequestTimeout = openfgaSec.Key("request_timeout").MustDuration(0)
	zs.OpenFgaServerSettings.MaxAuthorizationModelSizeInBytes = openfgaSec.Key("max_authorization_model_size_in_bytes").MustInt(0)
	zs.OpenFgaServerSettings.AuthorizationModelCacheSize = openfgaSec.Key("authorization_model_cache_size").MustInt(0)
	zs.OpenFgaServerSettings.ChangelogHorizonOffset = openfgaSec.Key("changelog_horizon_offset").MustInt(0)

	cfg.ZanzanaServer = zs
}
