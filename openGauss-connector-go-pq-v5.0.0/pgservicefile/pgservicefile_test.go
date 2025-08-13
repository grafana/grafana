package pgservicefile

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestParseServiceFile(t *testing.T) {
	buf := bytes.NewBufferString(`# A comment
[abc]
host=abc.example.com
port=9999
dbname=abcdb
user=abcuser
# Another comment

[def]
host = def.example.com
dbname = defdb
user = defuser
application_name = has space
`,
	)

	serviceFile, err := ParseServiceFile(buf)
	require.NoError(t, err)
	require.NotNil(t, serviceFile)

	assert.Len(t, serviceFile.Services, 2)
	assert.Equal(t, "abc", serviceFile.Services[0].Name)
	assert.Equal(t, "def", serviceFile.Services[1].Name)

	abc, err := serviceFile.GetService("abc")
	require.NoError(t, err)
	assert.Equal(t, serviceFile.Services[0], abc)
	assert.Len(t, abc.Settings, 4)
	assert.Equal(t, "abc.example.com", abc.Settings["host"])
	assert.Equal(t, "9999", abc.Settings["port"])
	assert.Equal(t, "abcdb", abc.Settings["dbname"])
	assert.Equal(t, "abcuser", abc.Settings["user"])

	def, err := serviceFile.GetService("def")
	require.NoError(t, err)
	assert.Equal(t, serviceFile.Services[1], def)
	assert.Len(t, def.Settings, 4)
	assert.Equal(t, "def.example.com", def.Settings["host"])
	assert.Equal(t, "defdb", def.Settings["dbname"])
	assert.Equal(t, "defuser", def.Settings["user"])
	assert.Equal(t, "has space", def.Settings["application_name"])
}

func TestParseServiceFileWithInvalidFile(t *testing.T) {
	buf := bytes.NewBufferString("Invalid syntax\n")

	serviceFile, err := ParseServiceFile(buf)
	assert.Error(t, err)
	assert.Nil(t, serviceFile)
}
