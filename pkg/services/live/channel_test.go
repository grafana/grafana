package live

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

func TestParseChannel(t *testing.T) {
	addr := ParseChannel("aaa/bbb/ccc/ddd")
	require.True(t, addr.IsValid())

	ex := Channel{
		Scope:     "aaa",
		Namespace: "bbb",
		Path:      "ccc/ddd",
	}

	if diff := cmp.Diff(addr, ex); diff != "" {
		t.Fatalf("Result mismatch (-want +got):\n%s", diff)
	}
}

func TestParseChannel_IsValid(t *testing.T) {
	tests := []struct {
		name    string
		id      string
		isValid bool
	}{
		{
			name:    "valid",
			id:      "stream/cpu/test",
			isValid: true,
		},
		{
			name:    "valid_long_path",
			id:      "stream/cpu/test/other",
			isValid: true,
		},
		{
			name:    "invalid_no_path",
			id:      "grafana/bbb",
			isValid: false,
		},
		{
			name:    "invalid_only_scope",
			id:      "grafana",
			isValid: false,
		},
		{
			name:    "push_scope_no_path_valid",
			id:      "push/telegraf",
			isValid: true,
		},
		{
			name:    "push_scope_with_path_invalid",
			id:      "push/telegraf/test",
			isValid: false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := ParseChannel(tt.id); got.IsValid() != tt.isValid {
				t.Errorf("unexpected isValid result for %s", tt.id)
			}
		})
	}
}

func TestChannel_String(t *testing.T) {
	type fields struct {
		Scope     string
		Namespace string
		Path      string
	}
	tests := []struct {
		name   string
		fields fields
		want   string
	}{
		{
			"with_all_parts",
			fields{Scope: ScopeStream, Namespace: "telegraf", Path: "test"},
			"stream/telegraf/test",
		},
		{
			"with_scope_and_namespace",
			fields{Scope: ScopeStream, Namespace: "telegraf"},
			"stream/telegraf",
		},
		{
			"with_scope_only",
			fields{Scope: ScopeStream},
			"stream",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Channel{
				Scope:     tt.fields.Scope,
				Namespace: tt.fields.Namespace,
				Path:      tt.fields.Path,
			}.String()
			if got != tt.want {
				t.Errorf("String() = %v, want %v", got, tt.want)
			}
		})
	}
}
