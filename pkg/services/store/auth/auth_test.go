package storeauth

import (
	"context"
	"testing"

	"github.com/grafana/grafana/pkg/infra/filestorage"
	"github.com/grafana/grafana/pkg/models"
	ac "github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/stretchr/testify/require"
)

func TestAuth(t *testing.T) {
	actions := []string{
		ac.ActionFilesWrite,
		ac.ActionFilesRead,
	}

	prefixes := []string{
		"",
		"/",
		"/my-storage/",
	}

	authService := NewStorageAuthService()

	var tests = []struct {
		name          string
		scopes        []string
		path          string
		expectedDeny  []string
		expectedAllow []string
	}{
		{
			name: "can not access anything without an allow rule (deny by default)",
			scopes: []string{
				fileScope("/b/*"),
			},
			expectedDeny: []string{
				"/a/b.jpg",
				"/a/",
				"/c",
			},
			expectedAllow: []string{
				"/",
				"/b/",
				"/b/a.jpg",
			},
		},
		{
			name: "can access any path with /* filescope",
			scopes: []string{
				fileScope("/*"),
			},
			expectedAllow: []string{
				"/a/b/c/d/e.jpg",
			},
		},
		{
			name: "can not access paths which are explicitly denied",
			scopes: []string{
				fileScope("/*"),
				fileScope("!/a/b/c/d/e.jpg"),
			},
			expectedDeny: []string{
				"/a/b/c/d/e.jpg",
			},
			expectedAllow: []string{
				"/a/b/c/d/x.jpg",
				"/a/b/c/d/",
			},
		},
		{
			name: "can not access paths with denied prefixes - parent folder",
			scopes: []string{
				fileScope("/*"),
				fileScope("!/a/b/c/*"),
			},
			expectedDeny: []string{
				"/a/b/c/d/e.jpg",
			},
			expectedAllow: []string{
				"/a/b/x/d/e.jpg",
			},
		},
		{
			name: "can not access paths with denied prefixes - root folder",
			scopes: []string{
				fileScope("/*"),
				fileScope("!/*"),
			},
			expectedDeny: []string{
				"/a/b/c/d/e.jpg",
			},
		},
		{
			name: "can not access paths with denied prefixes - same folder",
			scopes: []string{
				fileScope("/*"),
				fileScope("!/a/b/c/d/e*"),
			},
			expectedDeny: []string{
				"/a/b/c/d/e.jpg",
			},
		},
		{
			name: "can not access paths with denied prefixes - parent folder with a dot",
			scopes: []string{
				fileScope("/*"),
				fileScope("!/a/b/c/d.*"),
			},
			expectedDeny: []string{
				"/a/b/c/d.e/f.jpg",
			},
		},
		{
			name: "can not access paths with denied prefixes even if path is explicitly allowed - deny takes priority",
			scopes: []string{
				fileScope("/*"),
				fileScope("!/a/*"),
				fileScope("/a/b/c/d/f.jpg"),
			},
			expectedDeny: []string{
				"/a/b/c/d/f.jpg",
			},
		},
		{
			name: "can access all folders on the way to an explicitly allowed path",
			scopes: []string{
				fileScope("/a/b/c/d/f.jpg"),
			},
			expectedAllow: []string{
				"/a/b/c/d/f.jpg",
				"/a/b/c/d/",
				"/a/b/c/",
				"/a/b/",
				"/a/",
				"/",
			},
			expectedDeny: []string{
				"/a/b/c/f.jpg",
			},
		},
	}

	for _, prefix := range prefixes {
		for _, action := range actions {
			for _, tt := range tests {
				testName := "[" + prefix + "]" + action + " -  " + tt.name
				t.Run(testName, func(t *testing.T) {

					var scopes []string
					for _, scope := range tt.scopes {
						scopes = append(scopes, addPrefixToFileScope(scope, prefix))
					}

					permissions := map[int64]map[string][]string{0: {action: scopes}}
					guardian := authService.NewGuardian(context.Background(), &models.SignedInUser{
						UserId:      0,
						OrgId:       0,
						Permissions: permissions,
					}, "")

					for _, expectedAllow := range tt.expectedAllow {
						path := filestorage.Join(prefix, expectedAllow)
						require.Truef(t, guardian.can(action, path), "expected access to %s", path)
					}

					for _, expectedDeny := range tt.expectedDeny {
						path := filestorage.Join(prefix, expectedDeny)
						require.Falsef(t, guardian.can(action, path), "expected no access to %s", path)
					}
				})
			}
		}
	}
}
