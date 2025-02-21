package clients

import (
	"context"
	"encoding/hex"
	"errors"
	"fmt"
	"hash/fnv"
	"net"
	"path"
	"strconv"
	"strings"
	"time"

	claims "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/pkg/apimachinery/errutil"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/remotecache"
	"github.com/grafana/grafana/pkg/services/authn"
	"github.com/grafana/grafana/pkg/services/login"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/grafana/grafana/pkg/util"
)

const (
	proxyFieldName   = "Name"
	proxyFieldEmail  = "Email"
	proxyFieldLogin  = "Login"
	proxyFieldRole   = "Role"
	proxyFieldGroups = "Groups"
	proxyCachePrefix = "authn-proxy-sync-ttl"
)

var proxyFields = [...]string{proxyFieldName, proxyFieldEmail, proxyFieldLogin, proxyFieldRole, proxyFieldGroups}

var (
	errNotAcceptedIP      = errutil.Unauthorized("auth-proxy.invalid-ip")
	errEmptyProxyHeader   = errutil.Unauthorized("auth-proxy.empty-header")
	errInvalidProxyHeader = errutil.Internal("auth-proxy.invalid-proxy-header")
)

var (
	_ authn.HookClient         = new(Proxy)
	_ authn.ContextAwareClient = new(Proxy)
)

func ProvideProxy(cfg *setting.Cfg, cache proxyCache, clients ...authn.ProxyClient) (*Proxy, error) {
	list, err := parseAcceptList(cfg.AuthProxy.Whitelist)
	if err != nil {
		return nil, err
	}
	return &Proxy{log.New(authn.ClientProxy), cfg, cache, clients, list}, nil
}

type proxyCache interface {
	Get(ctx context.Context, key string) ([]byte, error)
	Set(ctx context.Context, key string, value []byte, expire time.Duration) error
	Delete(ctx context.Context, key string) error
}

type Proxy struct {
	log         log.Logger
	cfg         *setting.Cfg
	cache       proxyCache
	clients     []authn.ProxyClient
	acceptedIPs []*net.IPNet
}

func (c *Proxy) Name() string {
	return authn.ClientProxy
}

func (c *Proxy) Authenticate(ctx context.Context, r *authn.Request) (*authn.Identity, error) {
	if !c.isAllowedIP(r) {
		return nil, errNotAcceptedIP.Errorf("request ip is not in the configured accept list")
	}

	username := getProxyHeader(r, c.cfg.AuthProxy.HeaderName, c.cfg.AuthProxy.HeadersEncoded)
	if len(username) == 0 {
		return nil, errEmptyProxyHeader.Errorf("no username provided in auth proxy header")
	}

	additional := getAdditionalProxyHeaders(r, c.cfg)
	cacheKey, ok := getProxyCacheKey(username, additional)

	if c.cfg.AuthProxy.SyncTTL != 0 && ok {
		identity, errCache := c.retrieveIDFromCache(ctx, cacheKey, r)
		if errCache == nil {
			return identity, nil
		}

		if !errors.Is(errCache, remotecache.ErrCacheItemNotFound) {
			c.log.FromContext(ctx).Warn("Failed to fetch auth proxy info from cache", "error", errCache)
		}
	}

	var clientErr error
	for _, proxyClient := range c.clients {
		var identity *authn.Identity
		identity, clientErr = proxyClient.AuthenticateProxy(ctx, r, username, additional)
		if identity != nil {
			identity.ClientParams.CacheAuthProxyKey = cacheKey
			return identity, nil
		}
	}

	return nil, clientErr
}

func (c *Proxy) IsEnabled() bool {
	return c.cfg.AuthProxy.Enabled
}

// See if we have cached the user id, in that case we can fetch the signed-in user and skip sync.
// Error here means that we could not find anything in cache, so we can proceed as usual
func (c *Proxy) retrieveIDFromCache(ctx context.Context, cacheKey string, r *authn.Request) (*authn.Identity, error) {
	entry, err := c.cache.Get(ctx, cacheKey)
	if err != nil {
		return nil, err
	}

	_, err = strconv.ParseInt(string(entry), 10, 64)
	if err != nil {
		return nil, fmt.Errorf("failed to parse user id from cache: %w - entry: %s", err, string(entry))
	}

	return &authn.Identity{
		ID:    string(entry),
		Type:  claims.TypeUser,
		OrgID: r.OrgID,
		// FIXME: This does not match the actual auth module used, but should not have any impact
		// Maybe caching the auth module used with the user ID would be a good idea
		AuthenticatedBy: login.AuthProxyAuthModule,
		ClientParams: authn.ClientParams{
			FetchSyncedUser: true,
			SyncPermissions: true,
		},
	}, nil
}

func (c *Proxy) Test(ctx context.Context, r *authn.Request) bool {
	return len(getProxyHeader(r, c.cfg.AuthProxy.HeaderName, c.cfg.AuthProxy.HeadersEncoded)) != 0
}

func (c *Proxy) Priority() uint {
	return 50
}

func (c *Proxy) Hook(ctx context.Context, id *authn.Identity, r *authn.Request) error {
	if id.ClientParams.CacheAuthProxyKey == "" {
		return nil
	}

	if !id.IsIdentityType(claims.TypeUser) {
		return nil
	}

	internalId, err := id.GetInternalID()
	if err != nil {
		c.log.Warn("Failed to cache proxy user", "error", err, "userId", id.GetID(), "err", err)
		return nil
	}

	// User's role would not be updated if the cache hit. If requests arrive in the following order:
	// 1. Name = x; Role = Admin			# cache missed, new user created and cached with key Name=x;Role=Admin
	// 2. Name = x; Role = Editor			# cache missed, the user got updated and cached with key Name=x;Role=Editor
	// 3. Name = x; Role = Admin			# cache hit with key Name=x;Role=Admin, no update, the user stays with Role=Editor
	// To avoid such a problem we also cache the key used using `prefix:[username]`.
	// Then whenever we get a cache miss due to changes in any header we use it to invalidate the previous item.
	username := getProxyHeader(r, c.cfg.AuthProxy.HeaderName, c.cfg.AuthProxy.HeadersEncoded)
	userKey := fmt.Sprintf("%s:%s", proxyCachePrefix, username)

	// invalidate previously cached user id
	if prevCacheKey, err := c.cache.Get(ctx, userKey); err == nil && len(prevCacheKey) > 0 {
		if err := c.cache.Delete(ctx, string(prevCacheKey)); err != nil {
			return err
		}
	}

	c.log.FromContext(ctx).Debug("Cache proxy user", "userId", internalId)
	bytes := []byte(strconv.FormatInt(internalId, 10))
	duration := time.Duration(c.cfg.AuthProxy.SyncTTL) * time.Minute
	if err := c.cache.Set(ctx, id.ClientParams.CacheAuthProxyKey, bytes, duration); err != nil {
		c.log.Warn("Failed to cache proxy user", "error", err, "userId", internalId)
	}

	// store current cacheKey for the user
	return c.cache.Set(ctx, userKey, []byte(id.ClientParams.CacheAuthProxyKey), duration)
}

func (c *Proxy) isAllowedIP(r *authn.Request) bool {
	if len(c.acceptedIPs) == 0 {
		return true
	}

	host, _, err := net.SplitHostPort(r.HTTPRequest.RemoteAddr)
	if err != nil {
		return false
	}

	ip := net.ParseIP(host)
	for _, v := range c.acceptedIPs {
		if v.Contains(ip) {
			return true
		}
	}

	return false
}

func parseAcceptList(s string) ([]*net.IPNet, error) {
	if len(strings.TrimSpace(s)) == 0 {
		return nil, nil
	}
	addresses := strings.Split(s, ",")
	list := make([]*net.IPNet, 0, len(addresses))
	for _, addr := range addresses {
		result, err := coerceProxyAddress(addr)
		if err != nil {
			return nil, err
		}
		list = append(list, result)
	}
	return list, nil
}

// coerceProxyAddress gets network of the presented CIDR notation
func coerceProxyAddress(proxyAddr string) (*net.IPNet, error) {
	proxyAddr = strings.TrimSpace(proxyAddr)
	if !strings.Contains(proxyAddr, "/") {
		proxyAddr = path.Join(proxyAddr, "32")
	}

	_, network, err := net.ParseCIDR(proxyAddr)
	if err != nil {
		return nil, fmt.Errorf("could not parse the network: %w", err)
	}
	return network, nil
}

func getProxyHeader(r *authn.Request, headerName string, encoded bool) string {
	if r.HTTPRequest == nil {
		return ""
	}
	v := r.HTTPRequest.Header.Get(headerName)
	if encoded {
		v = util.DecodeQuotedPrintable(v)
	}
	return v
}

func getAdditionalProxyHeaders(r *authn.Request, cfg *setting.Cfg) map[string]string {
	additional := make(map[string]string, len(proxyFields))
	for _, k := range proxyFields {
		if v := getProxyHeader(r, cfg.AuthProxy.Headers[k], cfg.AuthProxy.HeadersEncoded); v != "" {
			additional[k] = v
		}
	}
	return additional
}

func getProxyCacheKey(username string, additional map[string]string) (string, bool) {
	key := strings.Builder{}
	key.WriteString(username)
	for _, k := range proxyFields {
		if v, ok := additional[k]; ok {
			key.WriteString(v)
		}
	}

	hash := fnv.New128a()
	if _, err := hash.Write([]byte(key.String())); err != nil {
		return "", false
	}

	return strings.Join([]string{proxyCachePrefix, hex.EncodeToString(hash.Sum(nil))}, ":"), true
}
