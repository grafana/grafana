package sqlite

import "github.com/openfga/openfga/pkg/storage/sqlcommon"

type Config struct {
	*sqlcommon.Config
	QueryRetries int
}

func NewConfig() *Config {
	return &Config{
		Config:       sqlcommon.NewConfig(),
		QueryRetries: 0,
	}
}
