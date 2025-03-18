package setting

type RemoteCacheSettings struct {
	Name       string
	ConnStr    string
	Prefix     string
	Encryption bool
}

func (cfg *Cfg) readRemoteCacheSettings() {
	cacheServer := cfg.Raw.Section("remote_cache")
	dbName := valueAsString(cacheServer, "type", "database")
	connStr := valueAsString(cacheServer, "connstr", "")
	prefix := valueAsString(cacheServer, "prefix", "")
	encryption := cacheServer.Key("encryption").MustBool(false)

	cfg.RemoteCacheOptions = &RemoteCacheSettings{
		Name:       dbName,
		ConnStr:    connStr,
		Prefix:     prefix,
		Encryption: encryption,
	}
}
