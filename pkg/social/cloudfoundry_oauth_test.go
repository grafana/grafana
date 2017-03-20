package social

import "testing"

func TestCFOAuth_hasAuthorizedOrg(t *testing.T) {
	t.Parallel()

	cf := CFOAuth{
		allowedOrgs: map[string][]string{
			"foo": []string{},
			"bar": []string{"baz"},
		},
	}

	for _, userOrgs := range []map[string][]string{
		{"foo": []string{}},
		{"bar": []string{"baz"}},
	} {
		if !cf.hasAuthorizedOrg(userOrgs) {
			t.Errorf("hasAuthorizedOrg(%v) = false, want true", userOrgs)
		}
	}

	for _, userOrgs := range []map[string][]string{
		{"bar": []string{}},
		{"bar": []string{"foo"}},
	} {
		if cf.hasAuthorizedOrg(userOrgs) {
			t.Errorf("hasAuthorizedOrg(%v) = true, want false", userOrgs)
		}
	}
}
