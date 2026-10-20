package namespacedgroups

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestOwner(t *testing.T) {
	tests := []struct {
		name      string
		group     string
		namespace string
		owner     string
	}{
		{"stack namespace", "myapp.stacks-123.gas.ext.grafana.app", "stacks-123", "gas.ext.grafana.app"},
		{"org namespace", "myapp.org-2.gas.ext.grafana.app", "org-2", "gas.ext.grafana.app"},
		{"default namespace", "myapp.default.gas.ext.grafana.app", "default", "gas.ext.grafana.app"},
		{"multi-label name", "a.b.default.gas.ext.grafana.app", "default", "gas.ext.grafana.app"},
		{"another namespace's group", "myapp.stacks-123.gas.ext.grafana.app", "stacks-456", ""},
		{"no namespace", "myapp.stacks-123.gas.ext.grafana.app", "", ""},
		{"wildcard namespace", "myapp.stacks-123.gas.ext.grafana.app", "*", ""},
		{"wildcard namespace in the group", "myapp.*.gas.ext.grafana.app", "*", ""},
		// Existing plugin groups don't name a namespace, so they keep their own permissions.
		{"plugin group", "gas.ext.grafana.app", "default", ""},
		{"two-label plugin group", "assistant.alertrules.ext.grafana.app", "alertrules", ""},
		{"three labels, label not the namespace", "a.alertrules.foo.ext.grafana.app", "default", ""},
		{"empty name", ".default.gas.ext.grafana.app", "default", ""},
		{"empty owner", "myapp.default..ext.grafana.app", "default", ""},
		{"not a plugin group", "myapp.default.dashboard.grafana.app", "default", ""},
		{"suffix only", ".ext.grafana.app", "default", ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			owner, ok := Owner(tt.group, tt.namespace)
			assert.Equal(t, tt.owner != "", ok)
			assert.Equal(t, tt.owner, owner)
		})
	}
}
