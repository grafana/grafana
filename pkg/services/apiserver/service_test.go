package apiserver

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/stretchr/testify/require"
)

func Test_useNamespaceFromPath(t *testing.T) {
	tests := []struct {
		name  string
		path  string
		expNs string
	}{
		{
			name:  "no namespace in path",
			path:  "/apis/folder.grafana.app/",
			expNs: "",
		},
		{
			name:  "namespace in path",
			path:  "/apis/folder.grafana.app/v1alpha1/namespaces/stacks-11/folders",
			expNs: "stacks-11",
		},
		{
			name:  "invalid namespace in path",
			path:  "/apis/folder.grafana.app/v1alpha1/namespaces/invalid/folders",
			expNs: "invalid",
		},
		{
			name:  "org namespace in path",
			path:  "/apis/folder.grafana.app/v1alpha1/namespaces/org-123/folders",
			expNs: "org-123",
		},
		{
			name:  "default namespace in path",
			path:  "/apis/folder.grafana.app/v1alpha1/namespaces/default/folders",
			expNs: "default",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			user := &user.SignedInUser{}
			useNamespaceFromPath(tt.path, user)
			if user.Namespace != tt.expNs {
				require.Equal(t, tt.expNs, user.Namespace, "expected namespace to be %s, got %s", tt.expNs, user.Namespace)
			}
		})
	}
}
