package server

import (
	"testing"

	authzv1 "github.com/grafana/authlib/authz/proto/v1"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/authz/zanzana/common"
)

func TestUserPermissionsAnnotationResources(t *testing.T) {
	const subject = "user:annotations"
	for _, tc := range []struct {
		name                              string
		organization, dashboard, wildcard bool
		want                              []string
	}{
		{name: "organization only", organization: true, want: []string{"annotations:type:organization"}},
		{name: "dashboard and folder", dashboard: true, want: []string{"dashboards:uid:dash1", "folders:uid:folder1"}},
		{name: "both resources", organization: true, dashboard: true, want: []string{"annotations:type:organization", "dashboards:uid:dash1", "folders:uid:folder1"}},
		{name: "dashboard wildcard", wildcard: true, want: []string{"dashboards:*", "folders:*"}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var tuples []*openfgav1.TupleKey
			for _, relation := range []string{common.RelationGet, common.RelationCreate, common.RelationUpdate, common.RelationDelete} {
				if tc.organization {
					tuples = append(tuples, common.NewGroupResourceTuple(subject, relation, "annotation.grafana.app", "annotations", ""))
				}
				if tc.dashboard {
					tuples = append(tuples,
						common.NewResourceTuple(subject, relation, dashboardGroup, dashboardResource, "annotations", "dash1"),
						common.NewFolderResourceTuple(subject, relation, dashboardGroup, dashboardResource, "annotations", "folder1"))
				}
				if tc.wildcard {
					tuples = append(tuples, common.NewGroupResourceTuple(subject, relation, dashboardGroup, dashboardResource, "annotations"))
				}
			}
			server, _, _ := newPermissionTestServer(t, tuples)
			stream := &permissionResponseStream{ctx: newContextWithNamespace()}
			require.NoError(t, server.GetUserPermissions(&authzv1.GetUserPermissionsRequest{Namespace: namespace, Subject: subject}, stream))
			scopes := map[string][]string{}
			for _, permission := range stream.permissions {
				scopes[permission.Action] = append(scopes[permission.Action], permission.Scope)
			}
			for _, action := range []string{"annotations:read", "annotations:create", "annotations:write", "annotations:delete"} {
				require.ElementsMatch(t, tc.want, scopes[action], action)
			}
		})
	}
}
