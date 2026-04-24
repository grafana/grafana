package app

import (
	"bytes"
	"context"
	"fmt"
	"hash/fnv"
	"strings"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/redis/go-redis/v9"
	"k8s.io/client-go/tools/cache"
)

var _ cache.Store = (*RedisStore)(nil)

const (
	defaultRedisCachePrefix  = "plugins-app:cache:"
	defaultRedisIndexBuckets = 256
	defaultRedisScanCount    = 1000
	defaultRedisGetBatchSize = 256
)

type RedisStore struct {
	ctx          context.Context
	client       redis.UniversalClient
	keyFunc      func(any) (string, error)
	kind         resource.Kind
	prefix       string
	gvrKey       string
	indexBuckets uint32
	scanCount    int64
	getBatchSize int
}

func NewRedisStore(kind resource.Kind, cfg RedisCacheConfig) (*RedisStore, error) {
	if cfg.Client == nil {
		return nil, fmt.Errorf("redis client is required")
	}

	ctx := cfg.Context
	if ctx == nil {
		ctx = context.Background()
	}

	if err := cfg.Client.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("ping redis: %w", err)
	}

	indexBuckets := cfg.IndexBuckets
	if indexBuckets <= 0 {
		indexBuckets = defaultRedisIndexBuckets
	}

	scanCount := cfg.ScanCount
	if scanCount <= 0 {
		scanCount = defaultRedisScanCount
	}

	getBatchSize := cfg.GetBatchSize
	if getBatchSize <= 0 {
		getBatchSize = defaultRedisGetBatchSize
	}

	return &RedisStore{
		ctx:          ctx,
		client:       cfg.Client,
		keyFunc:      cache.DeletionHandlingMetaNamespaceKeyFunc,
		kind:         kind,
		prefix:       normalizeRedisCachePrefix(cfg.Prefix),
		gvrKey:       fmt.Sprintf("%s/%s/%s", kind.Group(), kind.Version(), kind.Plural()),
		indexBuckets: uint32(indexBuckets),
		scanCount:    scanCount,
		getBatchSize: getBatchSize,
	}, nil
}

func normalizeRedisCachePrefix(prefix string) string {
	if prefix == "" {
		return defaultRedisCachePrefix
	}
	if !strings.HasSuffix(prefix, ":") {
		prefix += ":"
	}
	return prefix + defaultRedisCachePrefix
}

func (s *RedisStore) Add(obj any) error {
	return s.upsert(obj)
}

func (s *RedisStore) Update(obj any) error {
	return s.upsert(obj)
}

// convertibleIntoResourceObject is the subset of operator.ConvertableIntoResourceObject
// that RedisStore needs to convert watch-stream objects (e.g. *k8s.UntypedObjectWrapper)
// into typed resource.Object values before writing to Redis.
type convertibleIntoResourceObject interface {
	Into(resource.Object, resource.Codec) error
}

func (s *RedisStore) upsert(obj any) error {
	resourceObject, ok := obj.(resource.Object)
	if !ok {
		// The SDK reflector may deliver *k8s.UntypedObjectWrapper from the native
		// Kubernetes watch interface. Convert it to a typed resource.Object using
		// the kind's codec so we can write it to Redis.
		convertible, ok := obj.(convertibleIntoResourceObject)
		if !ok {
			return fmt.Errorf("expected resource.Object, got %T", obj)
		}
		newObj := s.kind.ZeroValue()
		if err := convertible.Into(newObj, s.kind.Codec(resource.KindEncodingJSON)); err != nil {
			return fmt.Errorf("converting %T to resource.Object: %w", obj, err)
		}
		resourceObject = newObj
	}

	externalKey, err := s.externalKey(obj)
	if err != nil {
		return err
	}

	var encoded bytes.Buffer
	if err := s.kind.Write(resourceObject, &encoded, resource.KindEncodingJSON); err != nil {
		return err
	}

	_, err = s.client.TxPipelined(s.ctx, func(pipe redis.Pipeliner) error {
		pipe.Set(s.ctx, s.objectKey(externalKey), encoded.Bytes(), 0)
		pipe.SAdd(s.ctx, s.indexKey(externalKey), externalKey)
		return nil
	})
	return err
}

func (s *RedisStore) Delete(obj any) error {
	externalKey, err := s.externalKey(obj)
	if err != nil {
		return err
	}

	_, err = s.client.TxPipelined(s.ctx, func(pipe redis.Pipeliner) error {
		pipe.Del(s.ctx, s.objectKey(externalKey))
		pipe.SRem(s.ctx, s.indexKey(externalKey), externalKey)
		return nil
	})
	return err
}

func (s *RedisStore) List() []any {
	items := make([]any, 0)

	for bucket := uint32(0); bucket < s.indexBuckets; bucket++ {
		keys, err := s.scanBucketKeys(s.ctx, bucket)
		if err != nil {
			logging.DefaultLogger.Error("error scanning redis cache keys", "bucket", bucket, "error", err)
			continue
		}
		for start := 0; start < len(keys); start += s.getBatchSize {
			end := min(start+s.getBatchSize, len(keys))
			batch := keys[start:end]

			replies, err := s.client.Pipelined(s.ctx, func(pipe redis.Pipeliner) error {
				for _, key := range batch {
					pipe.Get(s.ctx, s.objectKeyForBucket(bucket, key))
				}
				return nil
			})
			if err != nil && err != redis.Nil {
				logging.DefaultLogger.Error("error reading redis cache objects", "bucket", bucket, "error", err)
				continue
			}

			staleKeys := make([]string, 0)
			for i, reply := range replies {
				cmd, ok := reply.(*redis.StringCmd)
				if !ok {
					continue
				}
				value, err := cmd.Bytes()
				switch {
				case err == nil:
					item, readErr := s.kind.Read(bytes.NewReader(value), resource.KindEncodingJSON)
					if readErr != nil {
						logging.DefaultLogger.Error("error decoding redis cache object", "key", batch[i], "error", readErr)
						continue
					}
					items = append(items, item)
				case err == redis.Nil:
					staleKeys = append(staleKeys, batch[i])
				default:
					logging.DefaultLogger.Error("error getting redis cache object", "key", batch[i], "error", err)
				}
			}

			if len(staleKeys) > 0 {
				if err := s.removeStaleKeys(s.ctx, bucket, staleKeys); err != nil {
					logging.DefaultLogger.Error("error removing stale redis cache keys", "bucket", bucket, "error", err)
				}
			}
		}
	}

	return items
}

func (s *RedisStore) ListKeys() []string {
	keys := make([]string, 0)

	for bucket := uint32(0); bucket < s.indexBuckets; bucket++ {
		bucketKeys, err := s.scanBucketKeys(s.ctx, bucket)
		if err != nil {
			logging.DefaultLogger.Error("error scanning redis cache key index", "bucket", bucket, "error", err)
			continue
		}
		keys = append(keys, bucketKeys...)
	}

	return keys
}

func (s *RedisStore) Get(obj any) (item any, exists bool, err error) {
	externalKey, err := s.externalKey(obj)
	if err != nil {
		return nil, false, err
	}
	return s.getByExternalKey(s.ctx, externalKey)
}

func (s *RedisStore) GetByKey(key string) (item any, exists bool, err error) {
	return s.getByExternalKey(s.ctx, key)
}

func (s *RedisStore) getByExternalKey(ctx context.Context, externalKey string) (item any, exists bool, err error) {
	value, err := s.client.Get(ctx, s.objectKey(externalKey)).Bytes()
	switch {
	case err == nil:
		item, err = s.kind.Read(bytes.NewReader(value), resource.KindEncodingJSON)
		if err != nil {
			return nil, true, err
		}
		return item, true, nil
	case err == redis.Nil:
		if removeErr := s.client.SRem(ctx, s.indexKey(externalKey), externalKey).Err(); removeErr != nil {
			logging.DefaultLogger.Error("error removing stale redis cache key", "key", externalKey, "error", removeErr)
		}
		return nil, false, nil
	default:
		return nil, false, err
	}
}

func (*RedisStore) Replace([]any, string) error {
	return nil
}

func (*RedisStore) Resync() error {
	return nil
}

func (s *RedisStore) externalKey(obj any) (string, error) {
	if s.keyFunc == nil {
		return "", fmt.Errorf("no key func defined")
	}
	return s.keyFunc(obj)
}

func (s *RedisStore) bucketFor(externalKey string) uint32 {
	hasher := fnv.New32a()
	_, _ = hasher.Write([]byte(externalKey))
	return hasher.Sum32() % s.indexBuckets
}

func (s *RedisStore) slotTag(bucket uint32) string {
	return fmt.Sprintf("%s:%d", s.gvrKey, bucket)
}

func (s *RedisStore) indexKey(externalKey string) string {
	return s.indexKeyForBucket(s.bucketFor(externalKey))
}

func (s *RedisStore) indexKeyForBucket(bucket uint32) string {
	return fmt.Sprintf("%s{%s}:keys", s.prefix, s.slotTag(bucket))
}

func (s *RedisStore) objectKey(externalKey string) string {
	return s.objectKeyForBucket(s.bucketFor(externalKey), externalKey)
}

func (s *RedisStore) objectKeyForBucket(bucket uint32, externalKey string) string {
	return fmt.Sprintf("%s{%s}:obj:%s", s.prefix, s.slotTag(bucket), externalKey)
}

func (s *RedisStore) scanBucketKeys(ctx context.Context, bucket uint32) ([]string, error) {
	keys := make([]string, 0)
	cursor := uint64(0)
	for {
		batch, nextCursor, err := s.client.SScan(ctx, s.indexKeyForBucket(bucket), cursor, "", s.scanCount).Result()
		if err != nil {
			return nil, err
		}
		keys = append(keys, batch...)
		cursor = nextCursor
		if cursor == 0 {
			return keys, nil
		}
	}
}

func (s *RedisStore) removeStaleKeys(ctx context.Context, bucket uint32, keys []string) error {
	if len(keys) == 0 {
		return nil
	}

	members := make([]any, 0, len(keys))
	for _, key := range keys {
		members = append(members, key)
	}
	return s.client.SRem(ctx, s.indexKeyForBucket(bucket), members...).Err()
}
