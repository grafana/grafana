package usage

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/org"
	"github.com/grafana/grafana/pkg/services/org/orgtest"
	"github.com/grafana/grafana/pkg/setting"
)

func TestUsageNamespaceLister(t *testing.T) {
	ctx := context.Background()

	t.Run("cloud stack uses the default namespace and ignores orgs", func(t *testing.T) {
		// StackID set => cloud. The orgs must not be consulted.
		orgSvc := &orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}}}
		lister := UsageNamespaceLister(&setting.Cfg{StackID: "123"}, orgSvc)

		nss, err := lister(ctx)
		require.NoError(t, err)
		require.Equal(t, []string{"stacks-123"}, nss)
	})

	t.Run("on-prem enumerates one namespace per org", func(t *testing.T) {
		orgSvc := &orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}}}
		lister := UsageNamespaceLister(&setting.Cfg{}, orgSvc)

		nss, err := lister(ctx)
		require.NoError(t, err)
		require.Equal(t, []string{"default", "org-2"}, nss)
	})
}

func TestOrgNamespaceLister(t *testing.T) {
	ctx := context.Background()
	// On-prem mapper: org 1 -> "default", org N -> "org-N".
	onPremMapper := request.GetNamespaceMapper(&setting.Cfg{})

	t.Run("maps every org to its namespace", func(t *testing.T) {
		orgSvc := &orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}, {ID: 3}}}

		nss, err := orgNamespaceLister(onPremMapper, orgSvc)(ctx)
		require.NoError(t, err)
		require.Equal(t, []string{"default", "org-2", "org-3"}, nss)
	})

	t.Run("deduplicates namespaces", func(t *testing.T) {
		// A mapper that collapses every org to the same namespace (as cloud does).
		collapse := func(int64) string { return "stack-7" }
		orgSvc := &orgtest.FakeOrgService{ExpectedOrgs: []*org.OrgDTO{{ID: 1}, {ID: 2}, {ID: 3}}}

		nss, err := orgNamespaceLister(collapse, orgSvc)(ctx)
		require.NoError(t, err)
		require.Equal(t, []string{"stack-7"}, nss)
	})

	t.Run("returns empty when there are no orgs", func(t *testing.T) {
		orgSvc := &orgtest.FakeOrgService{ExpectedOrgs: nil}

		nss, err := orgNamespaceLister(onPremMapper, orgSvc)(ctx)
		require.NoError(t, err)
		require.Empty(t, nss)
	})

	t.Run("propagates the org service error", func(t *testing.T) {
		orgSvc := &orgtest.FakeOrgService{ExpectedError: errors.New("boom")}

		nss, err := orgNamespaceLister(onPremMapper, orgSvc)(ctx)
		require.Error(t, err)
		require.Nil(t, nss)
	})
}

func TestStackNamespaceLister(t *testing.T) {
	nss, err := stackNamespaceLister("123")(context.Background())
	require.NoError(t, err)
	require.Equal(t, []string{"stacks-123"}, nss)
}
