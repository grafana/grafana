package remotecache

import (
	"crypto/tls"
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	redis "gopkg.in/redis.v5"
)

func Test_parseRedisConnStr(t *testing.T) {
	cases := map[string]struct {
		InputConnStr  string
		OutputOptions *redis.Options
		ShouldErr     bool
	}{
		"all redis options should parse": {
			"addr=127.0.0.1:6379,pool_size=100,db=1,password=grafanaRocks,ssl=false",
			&redis.Options{
				Addr:      "127.0.0.1:6379",
				PoolSize:  100,
				DB:        1,
				Password:  "grafanaRocks",
				Network:   "tcp",
				TLSConfig: nil,
			},
			false,
		},
		"subset of redis options should parse": {
			"addr=127.0.0.1:6379,pool_size=100",
			&redis.Options{
				Addr:     "127.0.0.1:6379",
				PoolSize: 100,
				Network:  "tcp",
			},
			false,
		},
		"ssl set to true should result in default TLS configuration with tls set to addr's host": {
			"addr=grafana.com:6379,ssl=true",
			&redis.Options{
				Addr:      "grafana.com:6379",
				Network:   "tcp",
				TLSConfig: &tls.Config{ServerName: "grafana.com"},
			},
			false,
		},
		"ssl to insecure should result in TLS configuration with InsecureSkipVerify": {
			"addr=127.0.0.1:6379,ssl=insecure",
			&redis.Options{
				Addr:      "127.0.0.1:6379",
				Network:   "tcp",
				TLSConfig: &tls.Config{InsecureSkipVerify: true},
			},
			false,
		},
		"invalid SSL option should err": {
			"addr=127.0.0.1:6379,ssl=dragons",
			nil,
			true,
		},
		"invalid pool_size value should err": {
			"addr=127.0.0.1:6379,pool_size=seven",
			nil,
			true,
		},
		"invalid db value should err": {
			"addr=127.0.0.1:6379,db=seven",
			nil,
			true,
		},
		"trailing comma should err": {
			"addr=127.0.0.1:6379,pool_size=100,",
			nil,
			true,
		},
		"invalid key should err": {
			"addr=127.0.0.1:6379,puddle_size=100",
			nil,
			true,
		},
		"empty connection string should err": {
			"",
			nil,
			true,
		},
	}

	for reason, testCase := range cases {
		options, err := parseRedisConnStr(testCase.InputConnStr)
		if testCase.ShouldErr {
			assert.Error(t, err, fmt.Sprintf("error cases should return non-nil error for test case %v", reason))
			assert.Nil(t, options, fmt.Sprintf("error cases should return nil for redis options for test case %v", reason))
			continue
		}
		assert.NoError(t, err, reason)
		assert.EqualValues(t, testCase.OutputOptions, options, reason)

	}
}
