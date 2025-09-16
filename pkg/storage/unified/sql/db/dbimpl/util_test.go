package dbimpl

import (
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/setting"
)

var invalidUTF8ByteSequence = []byte{0xff, 0xfe, 0xfd}

func setSectionKeyValues(section *setting.DynamicSection, m map[string]string) {
	for k, v := range m {
		section.Key(k).SetValue(v)
	}
}

func newTestConfGetter(m map[string]string, keyPrefix string) confGetter {
	section := setting.NewCfg().SectionWithEnvOverrides("entity_api")
	setSectionKeyValues(section, m)

	return newConfGetter(section, keyPrefix)
}

func TestSectionGetter(t *testing.T) {
	t.Parallel()

	var (
		key           = "the key"
		keyBoolTrue   = "I'm true"
		keyBoolFalse  = "not me!"
		keyIntValid   = "valid_int"
		keyIntMissing = "missing_int"
		prefix        = "this is some prefix"
		val           = string(invalidUTF8ByteSequence)
	)

	t.Run("with prefix", func(t *testing.T) {
		t.Parallel()

		g := newTestConfGetter(map[string]string{
			prefix + key:          val,
			prefix + keyBoolTrue:  "YES",
			prefix + keyBoolFalse: "0",
			prefix + keyIntValid:  "42",
			// Note: keyIntMissing is intentionally not included to test default behavior
		}, prefix)

		require.False(t, g.Bool("whatever bool"))
		require.NoError(t, g.Err())

		require.False(t, g.Bool(keyBoolFalse))
		require.NoError(t, g.Err())

		require.True(t, g.Bool(keyBoolTrue))
		require.NoError(t, g.Err())

		require.Equal(t, 999, g.Int("whatever int", 999))
		require.NoError(t, g.Err())

		require.Equal(t, 42, g.Int(keyIntValid, 100))
		require.NoError(t, g.Err())

		require.Equal(t, 200, g.Int(keyIntMissing, 200))
		require.NoError(t, g.Err())

		require.Empty(t, g.String("whatever string"))
		require.NoError(t, g.Err())

		require.Empty(t, g.String(key))
		require.Error(t, g.Err())
		require.ErrorIs(t, g.Err(), errInvalidUTF8Sequence)
	})

	t.Run("without prefix", func(t *testing.T) {
		t.Parallel()

		g := newTestConfGetter(map[string]string{
			key:          val,
			keyBoolTrue:  "true",
			keyBoolFalse: "f",
			keyIntValid:  "123",
			// Note: keyIntMissing is intentionally not included to test default behavior
		}, "")

		require.False(t, g.Bool("whatever bool"))
		require.NoError(t, g.Err())

		require.False(t, g.Bool(keyBoolFalse))
		require.NoError(t, g.Err())

		require.True(t, g.Bool(keyBoolTrue))
		require.NoError(t, g.Err())

		require.Equal(t, 500, g.Int("whatever int", 500))
		require.NoError(t, g.Err())

		require.Equal(t, 123, g.Int(keyIntValid, 0))
		require.NoError(t, g.Err())

		require.Equal(t, 300, g.Int(keyIntMissing, 300))
		require.NoError(t, g.Err())

		require.Empty(t, g.String("whatever string"))
		require.NoError(t, g.Err())

		require.Empty(t, g.String(key))
		require.Error(t, g.Err())
		require.ErrorIs(t, g.Err(), errInvalidUTF8Sequence)
	})
}

func TestMakeDSN(t *testing.T) {
	t.Parallel()

	s, err := MakeDSN(map[string]string{
		"db_name": string(invalidUTF8ByteSequence),
	})
	require.Empty(t, s)
	require.Error(t, err)
	require.ErrorIs(t, err, errInvalidUTF8Sequence)

	s, err = MakeDSN(map[string]string{
		"skip": "",
		"user": `shou'ld esc\ape`,
		"pass": "noescape",
	})
	require.NoError(t, err)
	require.Equal(t, `pass=noescape user='shou\'ld esc\\ape'`, s)
}

func TestSplitHostPort(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		hostport    string
		defaultHost string
		defaultPort string
		fails       bool

		host string
		port string
	}{
		{hostport: "192.168.0.140:456", defaultHost: "", defaultPort: "", host: "192.168.0.140", port: "456"},
		{hostport: "192.168.0.140", defaultHost: "", defaultPort: "123", host: "192.168.0.140", port: "123"},
		{hostport: "[::1]:456", defaultHost: "", defaultPort: "", host: "::1", port: "456"},
		{hostport: "[::1]", defaultHost: "", defaultPort: "123", host: "::1", port: "123"},
		{hostport: ":456", defaultHost: "1.2.3.4", defaultPort: "", host: "1.2.3.4", port: "456"},
		{hostport: "xyz.rds.amazonaws.com", defaultHost: "", defaultPort: "123", host: "xyz.rds.amazonaws.com", port: "123"},
		{hostport: "xyz.rds.amazonaws.com:123", defaultHost: "", defaultPort: "", host: "xyz.rds.amazonaws.com", port: "123"},
		{hostport: "", defaultHost: "localhost", defaultPort: "1433", host: "localhost", port: "1433"},
		{hostport: "1:1:1", fails: true},
	}

	for i, tc := range testCases {
		t.Run(fmt.Sprintf("test index #%d", i), func(t *testing.T) {
			t.Parallel()

			host, port, err := splitHostPortDefault(tc.hostport, tc.defaultHost, tc.defaultPort)
			if tc.fails {
				require.Error(t, err)
				require.Empty(t, host)
				require.Empty(t, port)
			} else {
				require.NoError(t, err)
				require.Equal(t, tc.host, host)
				require.Equal(t, tc.port, port)
			}
		})
	}
}
