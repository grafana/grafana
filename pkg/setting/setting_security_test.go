package setting

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func newSecurityIni(t *testing.T, kvs [][2]string) *ini.File {
	t.Helper()
	f := ini.Empty()
	sec, err := f.NewSection("security")
	require.NoError(t, err)
	for _, kv := range kvs {
		_, err = sec.NewKey(kv[0], kv[1])
		require.NoError(t, err)
	}
	return f
}

func TestReadSecuritySettings_AllowEmbeddingHosts(t *testing.T) {
	t.Run("defaults to empty (no embedding allowed)", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, nil), cfg)
		require.NoError(t, err)
		assert.Empty(t, cfg.AllowEmbeddingHosts)
	})

	t.Run("allow_embedding=true sets wildcard for backwards compatibility", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding", "true"},
		}), cfg)
		require.NoError(t, err)
		assert.Equal(t, []string{"*"}, cfg.AllowEmbeddingHosts)
	})

	t.Run("allow_embedding_hosts=* sets wildcard", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding_hosts", "*"},
		}), cfg)
		require.NoError(t, err)
		assert.Equal(t, []string{"*"}, cfg.AllowEmbeddingHosts)
	})

	t.Run("allow_embedding_hosts takes precedence over allow_embedding=true", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding", "true"},
			{"allow_embedding_hosts", "wiki.example.com"},
			{"content_security_policy", "true"},
			{"content_security_policy_template", "default-src 'self'; $ALLOW_EMBEDDING_HOSTS"},
		}), cfg)
		require.NoError(t, err)
		assert.Equal(t, []string{"wiki.example.com"}, cfg.AllowEmbeddingHosts)
	})

	t.Run("allow_embedding_hosts with multiple hosts", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding_hosts", "wiki.example.com foo.example.com"},
			{"content_security_policy", "true"},
			{"content_security_policy_template", "default-src 'self'; $ALLOW_EMBEDDING_HOSTS"},
		}), cfg)
		require.NoError(t, err)
		assert.Equal(t, []string{"wiki.example.com", "foo.example.com"}, cfg.AllowEmbeddingHosts)
	})

	t.Run("specific hosts without CSP enabled returns error", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding_hosts", "wiki.example.com"},
		}), cfg)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "content_security_policy")
	})

	t.Run("specific hosts with CSP enabled but no template returns error", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding_hosts", "wiki.example.com"},
			{"content_security_policy", "true"},
		}), cfg)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "content_security_policy_template")
	})

	t.Run("specific hosts with CSP template missing $ALLOW_EMBEDDING_HOSTS returns error", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding_hosts", "wiki.example.com"},
			{"content_security_policy", "true"},
			{"content_security_policy_template", "default-src 'self'"},
		}), cfg)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "$ALLOW_EMBEDDING_HOSTS")
	})

	t.Run("specific hosts with valid CSP template succeeds", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding_hosts", "wiki.example.com"},
			{"content_security_policy", "true"},
			{"content_security_policy_template", "default-src 'self'; frame-ancestors $ALLOW_EMBEDDING_HOSTS"},
		}), cfg)
		require.NoError(t, err)
		assert.Equal(t, []string{"wiki.example.com"}, cfg.AllowEmbeddingHosts)
	})

	t.Run("wildcard does not require CSP configuration", func(t *testing.T) {
		cfg := NewCfg()
		err := readSecuritySettings(newSecurityIni(t, [][2]string{
			{"allow_embedding_hosts", "*"},
		}), cfg)
		require.NoError(t, err)
		assert.Equal(t, []string{"*"}, cfg.AllowEmbeddingHosts)
	})
}
