package serviceaccounts

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestIsExternalServiceAccount(t *testing.T) {
	tests := []struct {
		name  string
		login string
		want  bool
	}{
		{
			name:  "external service account",
			login: "sa-1-extsvc-test",
			want:  true,
		},
		{
			name:  "not external service account (too short)",
			login: "sa-1-test",
			want:  false,
		},
		{
			name:  "not external service account (wrong sa prefix)",
			login: "saN-1-extsvc-test",
			want:  false,
		},
		{
			name:  "not external service account (wrong extsvc prefix)",
			login: "sa-1-extsvcN-test",
			want:  false,
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsExternalServiceAccount(tt.login)
			require.Equal(t, tt.want, got)
		})
	}
}
