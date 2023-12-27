package setting

import "gopkg.in/ini.v1"

type RemoteCacheOptions struct {
	Name       string
	ConnStr    string
	Prefix     string
	Encryption bool
}

type ServerLockSettings struct {
	Driver string
}

const (
	DatabaseCacheType  = "database"
	RedisCacheType     = "redis"
	MemcachedCacheType = "memcached"

	DatabaseLockType    = "database"
	RemoteCacheLockType = "remote_cache"
)

func readRemoteCacheSettings(iniFile *ini.File) *RemoteCacheOptions {
	s := &RemoteCacheOptions{}
	cacheServer := iniFile.Section("remote_cache")
	s.Name = cacheServer.Key("type").In(DatabaseCacheType, []string{DatabaseCacheType, RedisCacheType, MemcachedCacheType})
	s.ConnStr = valueAsString(cacheServer, "connstr", "")
	s.Prefix = valueAsString(cacheServer, "prefix", "")
	s.Encryption = cacheServer.Key("encryption").MustBool(false)

	return s
}

func readServerLockSettings(iniFile *ini.File) ServerLockSettings {
	s := ServerLockSettings{}
	serverLock := iniFile.Section("server_lock")
	s.Driver = serverLock.Key("driver").In(DatabaseLockType, []string{DatabaseLockType, RemoteCacheLockType})

	return s
}
