package middleware

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestReplacePolicyVariables(t *testing.T) {
	t.Run("replaces $NONCE", func(t *testing.T) {
		result := ReplacePolicyVariables("script-src $NONCE", "https://grafana.example.com", CSPHostLists{}, "abc123")
		assert.Equal(t, "script-src 'nonce-abc123'", result)
	})

	t.Run("replaces $ROOT_PATH", func(t *testing.T) {
		result := ReplacePolicyVariables("connect-src ws://$ROOT_PATH", "https://grafana.example.com/", CSPHostLists{}, "abc123")
		assert.Equal(t, "connect-src ws://grafana.example.com/", result)
	})

	t.Run("replaces $ALLOW_EMBEDDING_HOSTS with 'none' when empty", func(t *testing.T) {
		result := ReplacePolicyVariables("frame-ancestors $ALLOW_EMBEDDING_HOSTS", "https://grafana.example.com", CSPHostLists{}, "abc123")
		assert.Equal(t, "frame-ancestors 'none'", result)
	})

	t.Run("replaces $ALLOW_EMBEDDING_HOSTS with host list", func(t *testing.T) {
		hosts := CSPHostLists{FrameAncestorHosts: []string{"wiki.example.com", "foo.example.com"}}
		result := ReplacePolicyVariables("frame-ancestors $ALLOW_EMBEDDING_HOSTS", "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "frame-ancestors wiki.example.com foo.example.com", result)
	})

	t.Run("replaces $FORM_ACTION_ADDITIONAL_HOSTS with empty string when no hosts configured", func(t *testing.T) {
		result := ReplacePolicyVariables("form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS", "https://grafana.example.com", CSPHostLists{}, "abc123")
		assert.Equal(t, "form-action 'self' ", result)
	})

	t.Run("replaces $FORM_ACTION_ADDITIONAL_HOSTS with additional hosts", func(t *testing.T) {
		hosts := CSPHostLists{FormActionAdditionalHosts: []string{"login.example.com", "auth.example.com"}}
		result := ReplacePolicyVariables("form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS", "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "form-action 'self' login.example.com auth.example.com", result)
	})

	t.Run("replaces $FORM_ACTION_ADDITIONAL_HOSTS with wildcard", func(t *testing.T) {
		hosts := CSPHostLists{FormActionAdditionalHosts: []string{"*"}}
		result := ReplacePolicyVariables("form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS", "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "form-action 'self' *", result)
	})

	t.Run("replaces both $ALLOW_EMBEDDING_HOSTS and $FORM_ACTION_ADDITIONAL_HOSTS in same template", func(t *testing.T) {
		hosts := CSPHostLists{
			FrameAncestorHosts:        []string{"embed.example.com"},
			FormActionAdditionalHosts: []string{"login.example.com"},
		}
		template := "frame-ancestors $ALLOW_EMBEDDING_HOSTS; form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS"
		result := ReplacePolicyVariables(template, "https://grafana.example.com", hosts, "abc123")
		assert.Equal(t, "frame-ancestors embed.example.com; form-action 'self' login.example.com", result)
	})

	t.Run("replaces all variables in a full CSP template", func(t *testing.T) {
		hosts := CSPHostLists{
			FrameAncestorHosts:        []string{"embed.example.com"},
			FormActionAdditionalHosts: []string{"login.example.com"},
		}
		template := "script-src 'self' $NONCE; connect-src ws://$ROOT_PATH; frame-ancestors $ALLOW_EMBEDDING_HOSTS; form-action 'self' $FORM_ACTION_ADDITIONAL_HOSTS"
		result := ReplacePolicyVariables(template, "https://grafana.example.com/", hosts, "testnonce")
		assert.Equal(t, "script-src 'self' 'nonce-testnonce'; connect-src ws://grafana.example.com/; frame-ancestors embed.example.com; form-action 'self' login.example.com", result)
	})
}
