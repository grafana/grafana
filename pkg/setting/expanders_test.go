package setting

import (
	"errors"
	"fmt"
	"math/rand"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestExpandVar_EnvSuccessful(t *testing.T) {
	const key = "GF_TEST_SETTING_EXPANDER_ENV"
	const expected = "aurora borealis"
	t.Setenv(key, expected)

	// expanded format
	{
		got, err := ExpandVar(fmt.Sprintf("$__env{%s}", key))
		assert.NoError(t, err)
		assert.Equal(t, expected, got)
	}

	// short format
	{
		got, err := ExpandVar(fmt.Sprintf("${%s}", key))
		assert.NoError(t, err)
		assert.Equal(t, expected, got)
	}
}

func TestExpandVar_FileSuccessful(t *testing.T) {
	f, err := os.CreateTemp(os.TempDir(), "file expansion *")
	require.NoError(t, err)
	file := f.Name()

	defer func() {
		err := os.Remove(file)
		require.NoError(t, err)
	}()

	_, err = f.WriteString("hello, world")
	require.NoError(t, err)
	err = f.Close()
	require.NoError(t, err)

	got, err := ExpandVar(fmt.Sprintf("$__file{%s}", file))
	assert.NoError(t, err)
	assert.Equal(t, "hello, world", got)
}

func TestExpandVar_FileDoesNotExist(t *testing.T) {
	got, err := ExpandVar(
		fmt.Sprintf("$__file{%s%sthisisnotarealfile_%d}",
			os.TempDir(),
			string(os.PathSeparator),
			rand.Int63()),
	)
	assert.Error(t, err)
	assert.True(t, errors.Is(err, os.ErrNotExist))
	assert.Empty(t, got)
}

func TestExpanderRegex(t *testing.T) {
	tests := map[string][][]string{
		// we should not expand variables where there are none
		"smoketest":                          {},
		"Pa$$word{0}":                        {},
		"$_almost{but not quite a variable}": {},
		// args are required
		"$__file{}": {},

		// base cases
		"${ENV}":             {{"", "ENV"}},
		"$__env{ENV}":        {{"__env", "ENV"}},
		"$__file{/dev/null}": {{"__file", "/dev/null"}},
		"$__vault{item}":     {{"__vault", "item"}},
		// contains a space in the argument
		"$__file{C:\\Program Files\\grafana\\something}": {{"__file", "C:\\Program Files\\grafana\\something"}},

		// complex cases
		"get variable from $__env{ENV}ironment":               {{"__env", "ENV"}},
		"$__env{VAR1} $__file{/var/lib/grafana/secrets/var1}": {{"__env", "VAR1"}, {"__file", "/var/lib/grafana/secrets/var1"}},
		"$__env{$__file{this is invalid}}":                    {{"__env", "$__file{this is invalid"}},
	}

	for input, expected := range tests {
		output := regex.FindAllStringSubmatch(input, -1)
		require.Len(t, output, len(expected))
		for i, variable := range output {
			assert.Equal(t, expected[i], variable[1:])
		}
	}
}

func TestScanFileExpansions_CapturesDatabasePassword(t *testing.T) {
	iniContent := `
[database]
password = $__file{/run/secrets/db_password}
user = grafana
`
	file, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	result := scanFileExpansions(file)

	require.NotNil(t, result)
	require.Contains(t, result, "database")
	require.Contains(t, result["database"], "password")
	assert.Equal(t, "/run/secrets/db_password", result["database"]["password"])
}

func TestScanFileExpansions_MultipleKeys(t *testing.T) {
	iniContent := `
[database]
password = $__file{/secrets/db_pwd}
user = grafana

[auth]
secret_key = $__file{/secrets/auth_key}
`
	file, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	result := scanFileExpansions(file)

	require.Contains(t, result, "database")
	assert.Equal(t, "/secrets/db_pwd", result["database"]["password"])
	require.Contains(t, result, "auth")
	assert.Equal(t, "/secrets/auth_key", result["auth"]["secret_key"])
}

func TestScanFileExpansions_NoFileExpansions(t *testing.T) {
	iniContent := `
[database]
password = mysecret
user = grafana
`
	file, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	result := scanFileExpansions(file)

	assert.NotNil(t, result)
	assert.Empty(t, result)
}

func TestScanFileExpansions_OnlyFileExpansionsRecorded(t *testing.T) {
	// env expansion should not be recorded, only file
	iniContent := `
[database]
password = $__file{/secrets/db_pwd}
host = $__env{DB_HOST}
`
	file, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	result := scanFileExpansions(file)

	require.Contains(t, result["database"], "password")
	assert.NotContains(t, result["database"], "host")
}
