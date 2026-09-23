package server

import (
	"fmt"
	"slices"
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/util/testutil"
)

func TestIntegrationRootFolderPermissions(t *testing.T) {
	testutil.SkipIntegrationTestInShortMode(t)
	srv := setupOpenFGAServer(t)

	for i, grant := range []string{"general", "other"} {
		ns := parityNamespace(i)
		writeParityTuples(t, srv, ns, []accesscontrol.Permission{{Action: "folders:admin", Scope: "folders:uid:" + grant}}, nil)
		for _, resource := range []string{"variables", "librarypanels"} {
			for _, parent := range []string{"", "general", "other", "unrelated"} {
				for _, verb := range []string{utils.VerbCreate, utils.VerbGet, utils.VerbUpdate, utils.VerbDelete} {
					t.Run(fmt.Sprintf("%s/%s/%s/%s", grant, resource, parent, verb), func(t *testing.T) {
						expectedParent := parent
						if parent == "" {
							expectedParent = "general"
						}
						res, err := srv.Check(newContextWithNamespace(), &authzv1.CheckRequest{
							Namespace: ns, Subject: paritySubject, Group: dashboardGroup, Resource: resource, Name: "item", Folder: parent, Verb: verb,
						})
						require.NoError(t, err)
						require.Equal(t, grant == expectedParent, res.GetAllowed())
						batch, err := srv.BatchCheck(newContextWithNamespace(), &authzv1.BatchCheckRequest{
							Namespace: ns, Subject: paritySubject,
							Checks: []*authzv1.BatchCheckItem{{CorrelationId: "item", Group: dashboardGroup, Resource: resource, Name: "item", Folder: parent, Verb: verb}},
						})
						require.NoError(t, err)
						require.Contains(t, batch.GetResults(), "item")
						require.Equal(t, grant == expectedParent, batch.GetResults()["item"].GetAllowed())
					})
				}
			}
			for _, verb := range []string{utils.VerbList, utils.VerbWatch} {
				t.Run(fmt.Sprintf("%s/%s/%s", grant, resource, verb), func(t *testing.T) {
					res, err := srv.List(newContextWithNamespace(), &authzv1.ListRequest{
						Namespace: ns, Subject: paritySubject, Group: dashboardGroup, Resource: resource, Verb: verb,
					})
					require.NoError(t, err)
					require.False(t, res.GetAll())
					require.Empty(t, res.GetItems())
					expected := []string{grant}
					if grant == "general" {
						expected = append(expected, "")
					}
					require.ElementsMatch(t, expected, res.GetFolders())
					for _, storedParent := range []string{"", "general"} {
						require.Equal(t, grant == "general", slices.Contains(res.GetFolders(), storedParent), "stored parent %q", storedParent)
					}
				})
			}
		}
		for _, kind := range []struct{ group, resource string }{
			{dashboardGroup, dashboardResource},
			{"example.grafana.app", "variables"},
			{"example.grafana.app", "librarypanels"},
		} {
			t.Run(grant+"/"+kind.group+"/"+kind.resource, func(t *testing.T) {
				res, err := srv.List(newContextWithNamespace(), &authzv1.ListRequest{
					Namespace: ns, Subject: paritySubject, Group: kind.group, Resource: kind.resource, Verb: utils.VerbList,
				})
				require.NoError(t, err)
				require.NotContains(t, res.GetFolders(), "", "other resource types must not inherit root grants through the empty parent")
			})
		}
	}
}
