package liveserver

import (
	"errors"
	"fmt"
	"net/url"
	"strings"

	"github.com/centrifugal/centrifuge"
	"github.com/redis/go-redis/v9"
)

// DefaultKeyPrefix is the Redis key prefix Live uses for its broker, presence
// and frame cache keys.
const DefaultKeyPrefix = "gf_live"

// RedisOptions configures a Live Redis engine.
type RedisOptions struct {
	// Address is a plain "host:port" address, or a redis:// or rediss:// (TLS)
	// connection URL.
	Address string
	// Password applies when Address carries no password of its own.
	Password string
	// Prefix is the Redis key prefix, usually DefaultKeyPrefix.
	Prefix string
}

// RedisClientOptions builds go-redis client options from opts, for clients
// that share the engine's Redis, such as the managed stream frame cache.
func RedisClientOptions(opts RedisOptions) (*redis.Options, error) {
	address := opts.Address
	if !strings.HasPrefix(address, "redis://") && !strings.HasPrefix(address, "rediss://") {
		return &redis.Options{Addr: address, Password: opts.Password}, nil
	}

	options, err := redis.ParseURL(address)
	if err != nil {
		// Parse errors can quote the URL or fragments of it (including
		// credentials), so never propagate them: return a static error.
		return nil, errors.New("invalid redis connection URL in ha_engine_address")
	}

	// go-redis's URL parser accepts ?skip_verify=true (InsecureSkipVerify);
	// certificate verification always stays on for Live HA, so reject it.
	if options.TLSConfig != nil && options.TLSConfig.InsecureSkipVerify {
		return nil, errors.New("skip_verify is not supported in ha_engine_address")
	}

	// Mirror the Centrifuge engine's credential precedence: a password set in
	// the URL wins, even an explicitly empty one; Password applies only when the
	// URL carries no password. go-redis cannot tell an absent URL password from
	// an empty one, so inspect the URL's userinfo directly (redis.ParseURL
	// accepted the address, so url.Parse cannot fail here).
	if u, err := url.Parse(address); err == nil {
		if _, ok := u.User.Password(); !ok {
			options.Password = opts.Password
		}
	}
	return options, nil
}

// SetupRedisEngine makes node use Redis for its broker and presence manager,
// so nodes sharing the Redis and prefix see each other's publications and
// presence.
func SetupRedisEngine(node *centrifuge.Node, opts RedisOptions) error {
	// Centrifuge parses redis:// and rediss:// (TLS) connection URLs in
	// Address natively, so the address is passed through as-is.
	redisShard, err := centrifuge.NewRedisShard(node, centrifuge.RedisShardConfig{
		Address:  opts.Address,
		Password: opts.Password,
	})
	if err != nil {
		return fmt.Errorf("error connecting to Live Redis: %v", err)
	}
	redisShards := []*centrifuge.RedisShard{redisShard}

	broker, err := centrifuge.NewRedisBroker(node, centrifuge.RedisBrokerConfig{
		Prefix: opts.Prefix,
		Shards: redisShards,
	})
	if err != nil {
		return fmt.Errorf("error creating Live Redis broker: %v", err)
	}
	node.SetBroker(broker)

	presenceManager, err := centrifuge.NewRedisPresenceManager(node, centrifuge.RedisPresenceManagerConfig{
		Prefix: opts.Prefix,
		Shards: redisShards,
	})
	if err != nil {
		return fmt.Errorf("error creating Live Redis presence manager: %v", err)
	}
	node.SetPresenceManager(presenceManager)

	return nil
}
