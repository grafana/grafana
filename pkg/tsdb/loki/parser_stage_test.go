package loki

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestBuildParserStage(t *testing.T) {
	t.Parallel()

	t.Run("empty when no hints", func(t *testing.T) {
		t.Parallel()
		stage, err := buildParserStage(nil)
		require.NoError(t, err)
		require.Empty(t, stage)
	})

	t.Run("passes through parser value", func(t *testing.T) {
		t.Parallel()
		stage, err := buildParserStage(map[string]string{
			"PARSER": `  json | pattern "<status>"  `,
		})
		require.NoError(t, err)
		require.Equal(t, `json | pattern "<status>"`, stage)
	})
}

func TestParserHintsFromSchemaContext(t *testing.T) {
	t.Parallel()

	hints := parserHintsFromSchemaContext(map[string]string{
		"PARSER": "json | unpack",
		"RATE":   "1m",
	})
	require.Equal(t, map[string]string{"PARSER": "json | unpack"}, hints)

	hints = parserHintsFromSchemaContext(map[string]string{" parser ": "json"})
	require.Equal(t, map[string]string{"PARSER": "json"}, hints)

	require.Nil(t, parserHintsFromSchemaContext(nil))
}
