package remotecache

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/assert"
	redis "gopkg.in/redis.v2"
)

func Test_parseRedisConnStr(t *testing.T) {
	cases := map[string]struct {
		InputConnStr  string
		OutputOptions *redis.Options
		ShouldErr     bool
	}{
		"all redis options should parse": {
			"addr=127.0.0.1:6379,pool_size=100,db=1,password=grafanaRocks",
			&redis.Options{
				Addr:     "127.0.0.1:6379",
				PoolSize: 100,
				DB:       1,
				Password: "grafanaRocks",
				Network:  "tcp",
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
