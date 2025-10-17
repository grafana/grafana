# Redis-based Alert Rule Caching

This document explains how to enable Redis caching for alert rules in Grafana OSS.

## Overview

By default, Grafana caches alert rules in local memory (per instance). When running multiple Grafana instances, you can configure them to use a shared Redis cache instead. This provides:

- **Shared cache across instances**: All instances share the same cache, improving hit rate
- **Cache survives restarts**: Cache persists across pod/instance restarts
- **Reduced database load**: Fewer database queries when cache is shared
- **Consistent invalidation**: Rule updates invalidate cache for all instances

## Configuration

### Step 1: Configure Remote Cache (Redis)

First, configure the `[remote_cache]` section to use Redis:

```ini
[remote_cache]
# Use Redis as the backend
type = redis

# Redis connection string
# Format: addr=host:port,password=secret,db=0,pool_size=100,ssl=false
connstr = addr=127.0.0.1:6379,db=0,pool_size=100

# Optional: Add a prefix to all cache keys
prefix = grafana:

# Optional: Enable encryption of cached values
encryption = false
```

For production with authentication and SSL:

```ini
[remote_cache]
type = redis
connstr = addr=redis.example.com:6379,username=grafana,password=yourpassword,db=0,pool_size=100,ssl=true
prefix = grafana:prod:
encryption = true
```

### Step 2: Enable Redis Cache for Alert Rules

Add this to the `[unified_alerting]` section:

```ini
[unified_alerting]
# Enable Redis-based caching for alert rules
# Valid values: "local" (default, in-memory) or "remote" (Redis)
alert_rule_cache_type = remote
```

### Complete Example

```ini
[database]
type = postgres
host = db.example.com:5432
name = grafana
user = grafana
password = dbpassword

[remote_cache]
type = redis
connstr = addr=redis.example.com:6379,password=redis_password,db=0,pool_size=100,ssl=true
prefix = grafana:cache:

[unified_alerting]
enabled = true
alert_rule_cache_type = remote
```

## Verification

After starting Grafana, check the logs for:

```
logger=ngalert.cache msg="Using remote cache (Redis) for alert rules"
```

Or for local cache:

```
logger=ngalert.cache msg="Using local in-memory cache for alert rules"
```

## Monitoring

### Cache Hit Rate

Watch for these log messages:

```
logger=ngalert.dbstore msg="Cache hit!" org_id=1 rules_count=47121 duration_ms=45
logger=ngalert.dbstore msg="Cache miss" org_id=1
```

### Performance Metrics

The cache operations are instrumented with Server-Timing headers. Check response headers for:

```
Server-Timing: cache-hit;dur=45, db-query;dur=2000, state-manager;dur=250
```

## Performance Expectations

### Local Cache (default)

- Cache retrieval: ~0.06ms
- Memory: ~50MB per instance for 47k rules
- Cache shared: No (per instance)
- Survives restart: No

### Redis Cache

- Cache retrieval: ~50-150ms (includes network + deserialization)
- Memory: ~50MB total (shared across all instances)
- Cache shared: Yes (all instances)
- Survives restart: Yes

### Database Query (cache miss)

- Query time: ~2000ms for 47k rules
- Database load: High

## Cache Behavior

### TTL (Time To Live)

- Default: 5 minutes
- Configured in code: `AlertRuleCacheTTL` in `alert_rule_cache.go`

### Invalidation

Cache is automatically invalidated when:

- Alert rule is created
- Alert rule is updated
- Alert rule is deleted

Invalidation affects all instances immediately when using Redis.

### Cache Key Format

```
alert-rules:{orgID}
```

For example: `alert-rules:1` for organization 1

### Data Format

Rules are stored as JSON-serialized `ngmodels.RulesGroup` objects.

## Troubleshooting

### Redis Connection Issues

**Error**: `Failed to get rules from remote cache`

Check:

1. Redis is running: `redis-cli ping`
2. Grafana can reach Redis: `telnet redis-host 6379`
3. Credentials are correct in `connstr`
4. Firewall allows connection

### JSON Serialization Errors

**Error**: `Failed to unmarshal rules from cache`

This indicates cache corruption. The cache will be automatically invalidated. To prevent:

- Ensure all Grafana instances run the same version
- Don't manually edit Redis keys

### High Latency

If Redis cache is slow (>200ms):

1. Check Redis server load: `redis-cli --latency`
2. Check network latency: `ping redis-host`
3. Consider using a local Redis instance
4. Increase `pool_size` in connection string

### Fallback to Local Cache

If Redis is unavailable, set:

```ini
[unified_alerting]
alert_rule_cache_type = local
```

And restart Grafana. Each instance will use local in-memory cache.

## Migration Path

### From Local to Redis

1. Configure `[remote_cache]` section
2. Test Redis connection: `redis-cli ping`
3. Update `[unified_alerting]` to set `alert_rule_cache_type = remote`
4. Rolling restart: Restart instances one by one
5. Verify in logs: Look for "Using remote cache"
6. Monitor cache hit rate and latency

### From Redis to Local

1. Update `[unified_alerting]` to set `alert_rule_cache_type = local`
2. Restart all instances
3. Optional: Clean up Redis keys: `redis-cli KEYS "alert-rules:*" | xargs redis-cli DEL`

## Advanced Configuration

### Multiple Redis Instances (Sentinels)

Not currently supported. Use a Redis proxy or load balancer.

### Redis Cluster Mode

Supported via `remote_cache` configuration:

```ini
[remote_cache]
type = redis
connstr = addr=node1:6379,addr=node2:6379,addr=node3:6379,password=secret
```

Refer to `pkg/infra/remotecache/redis_storage.go` for full connection string options.

## Cost-Benefit Analysis

### When to Use Redis Cache

✅ **Use Redis when:**

- Running 3+ Grafana instances
- High request volume (>100 req/min to rules endpoint)
- Database is a bottleneck
- Frequent deployments/restarts
- Need consistent cache across instances

❌ **Skip Redis when:**

- Single Grafana instance
- Low traffic
- Database has plenty of capacity
- Redis infrastructure not available
- Network latency to Redis >10ms

### Example Savings

With 3 instances, 100 requests/min to rules endpoint:

**Local cache:**

- Cache hit rate: 30% (per instance, different cache)
- Database queries/min: 70 \* 3 = 210
- Average response time: 1400ms

**Redis cache:**

- Cache hit rate: 80% (shared cache)
- Database queries/min: 20
- Average response time: 500ms

**Savings:** 90% fewer DB queries, 64% faster response time

## Security Considerations

### Encryption in Transit

- Enable SSL: `ssl=true` in connection string
- Configure Redis to require TLS

### Encryption at Rest

- Set `encryption = true` in `[remote_cache]`
- Uses Grafana's secrets encryption key
- Slightly slower (encryption overhead)

### Access Control

- Use Redis AUTH: `password=secret` in connection string
- Use Redis ACLs to limit Grafana's permissions
- Minimum required: `GET`, `SET`, `DEL` commands

### Network Isolation

- Run Redis in private network
- Use firewall rules to restrict access
- Consider using Redis Sentinel for HA

## See Also

- [Remote Cache Configuration](conf/sample.ini) - Full remote_cache options
- [Unified Alerting Settings](pkg/setting/setting_unified_alerting.go) - All alerting options
- [Performance Optimizations](PERFORMANCE_OPTIMIZATIONS.md) - Overall performance improvements
