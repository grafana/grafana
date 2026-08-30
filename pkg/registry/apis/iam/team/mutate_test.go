package team

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
)

func TestMutateOnCreateAndUpdate_ExternalGroups(t *testing.T) {
	tests := []struct {
		name string
		in   []string
		want []string
	}{
		{
			name: "nil is left as nil",
			in:   nil,
			want: nil,
		},
		{
			name: "empty slice is left as empty",
			in:   []string{},
			want: []string{},
		},
		{
			name: "mixed-case entries are lowercased and sorted",
			in:   []string{"LDAP-Admins", "ldap-Viewers", "LDAP-Editors"},
			want: []string{"ldap-admins", "ldap-editors", "ldap-viewers"},
		},
		{
			name: "whitespace is trimmed",
			in:   []string{"  ldap-admins  ", "\tldap-viewers\n"},
			want: []string{"ldap-admins", "ldap-viewers"},
		},
		{
			name: "duplicates are preserved (validation rejects them)",
			in:   []string{"LDAP-Admins", "ldap-admins"},
			want: []string{"ldap-admins", "ldap-admins"},
		},
		{
			name: "empty entries are preserved (validation rejects them)",
			in:   []string{"foo", "   "},
			want: []string{"", "foo"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			obj := &iamv0alpha1.Team{Spec: iamv0alpha1.TeamSpec{ExternalGroups: tc.in}}
			require.NoError(t, MutateOnCreateAndUpdate(context.Background(), obj))
			require.Equal(t, tc.want, obj.Spec.ExternalGroups)
		})
	}
}
