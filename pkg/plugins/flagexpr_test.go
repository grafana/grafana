package plugins

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFlagExpr_UnmarshalJSON(t *testing.T) {
	t.Run("static true", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`true`), &f))
		require.NotNil(t, f.Static)
		require.True(t, *f.Static)
		require.Nil(t, f.Flag)
	})

	t.Run("static false", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`false`), &f))
		require.NotNil(t, f.Static)
		require.False(t, *f.Static)
	})

	t.Run("bare flag key fails closed by default", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`"my-plugin.myFlag"`), &f))
		require.Nil(t, f.Static)
		require.NotNil(t, f.Flag)
		require.Equal(t, "my-plugin.myFlag", *f.Flag)
		require.False(t, f.Fallback)
	})

	t.Run("explicit object form sets flag and fallback", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`{"flag": "my-plugin.myFlag", "fallback": true}`), &f))
		require.Nil(t, f.Static)
		require.NotNil(t, f.Flag)
		require.Equal(t, "my-plugin.myFlag", *f.Flag)
		require.True(t, f.Fallback)
	})

	t.Run("object form without fallback defaults it to false", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`{"flag": "my-plugin.myFlag"}`), &f))
		require.NotNil(t, f.Flag)
		require.False(t, f.Fallback)
	})

	t.Run("object form missing flag is rejected", func(t *testing.T) {
		var f FlagExpr
		require.Error(t, json.Unmarshal([]byte(`{"fallback": true}`), &f))
	})

	t.Run("neither bool, string, nor object is rejected", func(t *testing.T) {
		var f FlagExpr
		require.Error(t, json.Unmarshal([]byte(`42`), &f))
	})

	t.Run("decoding a string into an instance previously decoded as a bool clears Static", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`true`), &f))
		require.NotNil(t, f.Static)

		require.NoError(t, json.Unmarshal([]byte(`"my-plugin.myFlag"`), &f))
		require.Nil(t, f.Static)
		require.NotNil(t, f.Flag)
	})
}

func TestFlagExpr_MarshalJSON(t *testing.T) {
	t.Run("static round-trips", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`true`), &f))
		out, err := json.Marshal(&f)
		require.NoError(t, err)
		require.Equal(t, `true`, string(out))
	})

	t.Run("bare key marshals to the canonical object form", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`"my-plugin.myFlag"`), &f))
		out, err := json.Marshal(&f)
		require.NoError(t, err)
		require.JSONEq(t, `{"flag": "my-plugin.myFlag", "fallback": false}`, string(out))
	})

	t.Run("explicit object round-trips", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`{"flag": "my-plugin.myFlag", "fallback": true}`), &f))
		out, err := json.Marshal(&f)
		require.NoError(t, err)
		require.JSONEq(t, `{"flag": "my-plugin.myFlag", "fallback": true}`, string(out))
	})
}
