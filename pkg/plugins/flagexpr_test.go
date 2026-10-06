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
		require.Nil(t, f.Template)
	})

	t.Run("static false", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`false`), &f))
		require.NotNil(t, f.Static)
		require.False(t, *f.Static)
	})

	t.Run("bare flag key expands to a fail-closed expression", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`"my-plugin.myFlag"`), &f))
		require.Nil(t, f.Static)
		require.NotNil(t, f.Template)
		require.Equal(t, "{{ flag `my-plugin.myFlag` false }}", f.raw)
	})

	t.Run("explicit template expression is kept as-is", func(t *testing.T) {
		var f FlagExpr
		src := "{{ flag `my-plugin.myFlag` true }}"
		require.NoError(t, json.Unmarshal([]byte(`"`+src+`"`), &f))
		require.Nil(t, f.Static)
		require.Equal(t, src, f.raw)
	})

	t.Run("compound expression with or/and/not parses", func(t *testing.T) {
		var f FlagExpr
		src := "{{ or (flag `a` false) (not (flag `b` true)) }}"
		require.NoError(t, json.Unmarshal([]byte(`"`+src+`"`), &f))
		require.NotNil(t, f.Template)
	})

	t.Run("malformed template expression is rejected at unmarshal time", func(t *testing.T) {
		var f FlagExpr
		err := json.Unmarshal([]byte(`"{{ flag `+"`"+`a`+"`"+` }}"`), &f) // missing required fallback arg
		require.Error(t, err)
	})

	t.Run("two flag actions concatenated without or/and is rejected at unmarshal time", func(t *testing.T) {
		var f FlagExpr
		src := "{{ flag `a` false }}{{ flag `b` true }}" // renders e.g. "truefalse", not a bool
		err := json.Unmarshal([]byte(`"`+src+`"`), &f)
		require.Error(t, err)
		require.Contains(t, err.Error(), "does not evaluate to a boolean")
	})

	t.Run("neither bool nor string is rejected", func(t *testing.T) {
		var f FlagExpr
		require.Error(t, json.Unmarshal([]byte(`42`), &f))
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

	t.Run("template round-trips to its (possibly expanded) source", func(t *testing.T) {
		var f FlagExpr
		require.NoError(t, json.Unmarshal([]byte(`"my-plugin.myFlag"`), &f))
		out, err := json.Marshal(&f)
		require.NoError(t, err)
		require.Equal(t, `"{{ flag `+"`"+`my-plugin.myFlag`+"`"+` false }}"`, string(out))
	})
}
