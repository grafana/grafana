package v1beta2

import (
	"encoding/json"
	"fmt"
	"regexp"
	"testing"

	"github.com/stretchr/testify/require"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/randfill"

	"github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type subresourcePair struct {
	v0alpha1 func() runtime.Object
	v1beta2  func() runtime.Object
}

var subresourcePairs = map[string]subresourcePair{
	"TestResults": {
		func() runtime.Object { return &v0alpha1.TestResults{} },
		func() runtime.Object { return &TestResults{} },
	},
	"ResourceWrapper": {
		func() runtime.Object { return &v0alpha1.ResourceWrapper{} },
		func() runtime.Object { return &ResourceWrapper{} },
	},
	"FileList": {
		func() runtime.Object { return &v0alpha1.FileList{} },
		func() runtime.Object { return &FileList{} },
	},
	"RefList": {
		func() runtime.Object { return &v0alpha1.RefList{} },
		func() runtime.Object { return &RefList{} },
	},
	"ResourceList": {
		func() runtime.Object { return &v0alpha1.ResourceList{} },
		func() runtime.Object { return &ResourceList{} },
	},
	"ResourceCountList": {
		func() runtime.Object { return &v0alpha1.ResourceCountList{} },
		func() runtime.Object { return &ResourceCountList{} },
	},
	"ResourceStats": {
		func() runtime.Object { return &v0alpha1.ResourceStats{} },
		func() runtime.Object { return &ResourceStats{} },
	},
	"HistoryList": {
		func() runtime.Object { return &v0alpha1.HistoryList{} },
		func() runtime.Object { return &HistoryList{} },
	},
	"WebhookResponse": {
		func() runtime.Object { return &v0alpha1.WebhookResponse{} },
		func() runtime.Object { return &WebhookResponse{} },
	},
	"ExternalRepositoryList": {
		func() runtime.Object { return &v0alpha1.ExternalRepositoryList{} },
		func() runtime.Object { return &ExternalRepositoryList{} },
	},
	"ConnectionAuthorizeRequest": {
		func() runtime.Object { return &v0alpha1.ConnectionAuthorizeRequest{} },
		func() runtime.Object { return &ConnectionAuthorizeRequest{} },
	},
	"RepositoryViewList": {
		func() runtime.Object { return &v0alpha1.RepositoryViewList{} },
		func() runtime.Object { return &RepositoryViewList{} },
	},
}

func newSubresourceScheme(t *testing.T) *runtime.Scheme {
	t.Helper()
	scheme := runtime.NewScheme()
	require.NoError(t, v0alpha1.AddToScheme(scheme))
	require.NoError(t, AddToScheme(scheme))
	require.NoError(t, RegisterSubresourceConversions(scheme))
	return scheme
}

// newSubresourceFiller skips TypeMeta, which conversion leaves to the serializer, and the
// interface-typed badValue and raw managedFields, which randfill cannot fill validly (the golden fixtures cover it).
func newSubresourceFiller(seed int64) *randfill.Filler {
	return randfill.NewWithSeed(seed).
		NilChance(0.2).
		NumElements(1, 3).
		SkipFieldsWithPattern(regexp.MustCompile(`^(TypeMeta|BadValue|ManagedFields)$`)).
		Funcs(
			// v1beta2 job options are int32.
			func(i *int, c randfill.Continue) { *i = int(c.Int31()) },
			func(u *common.Unstructured, c randfill.Continue) {
				if c.Bool() {
					return
				}
				u.Object = map[string]any{"kind": c.String(8), "spec": map[string]any{"n": c.Int63()}}
			},
		)
}

func TestSubresourceTypesRegisteredAtV1beta2(t *testing.T) {
	scheme := newSubresourceScheme(t)
	for name, pair := range subresourcePairs {
		kinds, _, err := scheme.ObjectKinds(pair.v1beta2())
		require.NoError(t, err)
		require.Equal(t, []schema.GroupVersionKind{GroupVersion.WithKind(name)}, kinds)
	}
}

func TestSubresourceRoundTripFromV0alpha1(t *testing.T) {
	scheme := newSubresourceScheme(t)
	for name, pair := range subresourcePairs {
		t.Run(name, func(t *testing.T) {
			for seed := range int64(50) {
				original := pair.v0alpha1()
				newSubresourceFiller(seed).Fill(original)

				converted := pair.v1beta2()
				require.NoError(t, scheme.Convert(original, converted, nil))
				back := pair.v0alpha1()
				require.NoError(t, scheme.Convert(converted, back, nil))

				require.Equal(t, original, back, "seed %d", seed)
				requireSameJSON(t, original, converted)
			}
		})
	}
}

// Canonical v1beta2 objects are the ones a v0alpha1 object converts to: optional pointers
// in the embedded kind types are nil rather than pointing to a zero value.
func TestSubresourceRoundTripFromCanonicalV1beta2(t *testing.T) {
	scheme := newSubresourceScheme(t)
	for name, pair := range subresourcePairs {
		t.Run(name, func(t *testing.T) {
			for seed := range int64(50) {
				source := pair.v0alpha1()
				newSubresourceFiller(seed).Fill(source)
				canonical := pair.v1beta2()
				require.NoError(t, scheme.Convert(source, canonical, nil))

				converted := pair.v0alpha1()
				require.NoError(t, scheme.Convert(canonical, converted, nil))
				back := pair.v1beta2()
				require.NoError(t, scheme.Convert(converted, back, nil))

				require.Equal(t, canonical, back, "seed %d", seed)
			}
		})
	}
}

// The subresource types without embedded kind types have no optional pointers,
// so every v1beta2 value is canonical.
func TestSubresourceRoundTripFromFuzzedV1beta2(t *testing.T) {
	scheme := newSubresourceScheme(t)
	for name, pair := range subresourcePairs {
		switch name {
		case "TestResults", "WebhookResponse", "RepositoryViewList":
			continue
		}
		t.Run(name, func(t *testing.T) {
			for seed := range int64(50) {
				original := pair.v1beta2()
				newSubresourceFiller(seed).Fill(original)

				converted := pair.v0alpha1()
				require.NoError(t, scheme.Convert(original, converted, nil))
				back := pair.v1beta2()
				require.NoError(t, scheme.Convert(converted, back, nil))

				require.Equal(t, original, back, "seed %d", seed)
			}
		})
	}
}

func TestSubresourceGoldenJSON(t *testing.T) {
	golden := map[string]string{
		"TestResults": `{
			"code": 400,
			"success": false,
			"errors": [
				{"type": "FieldValueInvalid", "field": "spec.github.url", "detail": "bad url", "origin": "github", "badValue": {"url": "x"}},
				{"type": "FieldValueRequired"}
			]
		}`,
		"ResourceWrapper": `{
			"path": "dashboards/a.json",
			"ref": "main",
			"hash": "abc",
			"repository": {"type": "github", "title": "Repo", "namespace": "default", "name": "repo"},
			"urls": {"repositoryURL": "https://github.com/o/r", "sourceURL": "https://github.com/o/r/blob/main/a.json", "newPullRequestURL": "https://github.com/o/r/pull/new", "compareURL": "https://github.com/o/r/compare"},
			"timestamp": "2026-11-26T10:00:00Z",
			"resource": {
				"type": {"group": "dashboard.grafana.app", "version": "v1", "kind": "Dashboard", "resource": "dashboards", "classic": "dashboard"},
				"file": {"kind": "Dashboard", "spec": {"title": "A"}},
				"existing": {"kind": "Dashboard"},
				"action": "update",
				"dryRun": {"kind": "Dashboard"},
				"upsert": {"kind": "Dashboard"}
			},
			"errors": ["one", "two"]
		}`,
		"FileList": `{
			"metadata": {"resourceVersion": "7"},
			"items": [{"path": "a.json", "size": 10, "hash": "h", "modified": 1700000000, "author": "me"}, {"path": "b/"}]
		}`,
		"RefList": `{
			"metadata": {},
			"items": [{"name": "main", "hash": "abc", "refURL": "https://github.com/o/r/tree/main", "protected": true}, {"name": "dev"}]
		}`,
		"ResourceList": `{
			"metadata": {},
			"items": [{"path": "a.json", "group": "dashboard.grafana.app", "resource": "dashboards", "name": "a", "hash": "h", "time": 5, "title": "A", "folder": "f"}]
		}`,
		"ResourceCountList": `{
			"metadata": {},
			"items": [{"group": "dashboard.grafana.app", "resource": "dashboards", "count": 3}]
		}`,
		"ResourceStats": `{
			"metadata": {},
			"instance": [{"group": "dashboard.grafana.app", "resource": "dashboards", "count": 3}],
			"unmanaged": [{"group": "folder.grafana.app", "resource": "folders", "count": 1}],
			"managed": [{"kind": "repo", "id": "repo", "stats": [{"group": "dashboard.grafana.app", "resource": "dashboards", "count": 2}]}]
		}`,
		"HistoryList": `{
			"metadata": {},
			"items": [{"ref": "abc", "message": "init", "authors": [{"name": "Me", "username": "me", "avatarURL": "https://a"}], "createdAt": 1700000000}]
		}`,
		"WebhookResponse": `{
			"code": 202,
			"added": "queued",
			"job": {"action": "pull", "repository": "repo", "pull": {"incremental": true}, "pr": {"ref": "feature", "pr": 12, "hash": "abc", "url": "https://github.com/o/r/pull/12", "isFork": false}}
		}`,
		"ExternalRepositoryList": `{
			"metadata": {},
			"items": [{"name": "r", "owner": "o", "url": "https://github.com/o/r"}, {"name": "plain", "url": "https://git.example.com/plain.git"}]
		}`,
		"ConnectionAuthorizeRequest": `{
			"metadata": {"name": "conn", "namespace": "default"},
			"spec": {"code": "abc", "redirectURI": "https://grafana/callback"},
			"status": {"authorized": true}
		}`,
		"RepositoryViewList": `{
			"allowedTargets": ["instance", "folder"],
			"allowImageRendering": true,
			"maxRepositories": 10,
			"availableRepositoryTypes": ["github", "git"],
			"availableConnectionTypes": ["github"],
			"availableResources": [{"group": "dashboard.grafana.app", "kind": "Dashboard"}, {"group": "folder.grafana.app", "kind": "Folder", "disabled": true}],
			"items": [{
				"name": "repo",
				"title": "Repo",
				"type": "github",
				"target": "folder",
				"branch": "main",
				"url": "https://github.com/o/r",
				"path": "grafana/",
				"workflows": ["write", "branch"],
				"commit": {"singleResourceMessageTemplate": "update {{.Path}}", "enforceTemplate": true},
				"branchOptions": {"nameTemplate": "grafana/{{.Title}}"},
				"pullRequest": {"titleTemplate": "Update", "generateDashboardPreviews": true}
			}]
		}`,
	}
	require.Len(t, golden, len(subresourcePairs))

	scheme := newSubresourceScheme(t)
	for name, pair := range subresourcePairs {
		t.Run(name, func(t *testing.T) {
			fixture := golden[name]

			source := pair.v0alpha1()
			require.NoError(t, json.Unmarshal([]byte(fixture), source))
			converted := pair.v1beta2()
			require.NoError(t, scheme.Convert(source, converted, nil))
			requireJSONEq(t, fixture, converted)

			source = pair.v1beta2()
			require.NoError(t, json.Unmarshal([]byte(fixture), source))
			converted = pair.v0alpha1()
			require.NoError(t, scheme.Convert(source, converted, nil))
			requireJSONEq(t, fixture, converted)
		})
	}
}

func TestSubresourceConversionRejectsPullRequestNumberAboveInt32(t *testing.T) {
	in := &v0alpha1.WebhookResponse{Job: &v0alpha1.JobSpec{
		Action: v0alpha1.JobActionPull,
		PullRequest: &v0alpha1.PullRequestJobOptions{
			PR: 1 << 31,
		},
	}}
	err := newSubresourceScheme(t).Convert(in, &WebhookResponse{}, nil)
	require.Error(t, err)
}

func TestHandWrittenSubresourceDeepCopy(t *testing.T) {
	results := &TestResults{Errors: []RepositoryErrorDetails{{
		Type:     "FieldValueInvalid",
		Field:    new("spec.url"),
		BadValue: map[string]any{"url": "x"},
	}}}
	resultsCopy := results.DeepCopyObject().(*TestResults)
	require.Equal(t, results, resultsCopy)
	*resultsCopy.Errors[0].Field = "changed"
	require.Equal(t, "spec.url", *results.Errors[0].Field)

	view := &RepositoryView{Name: "repo", Commit: &RepositoryCommitOptions{AuthorName: new("me")}}
	viewCopy := view.DeepCopy()
	require.Equal(t, view, viewCopy)
	*viewCopy.Commit.AuthorName = "changed"
	require.Equal(t, "me", *view.Commit.AuthorName)
}

func requireSameJSON(t *testing.T, expected, actual any) {
	t.Helper()
	data, err := json.Marshal(expected)
	require.NoError(t, err)
	requireJSONEq(t, string(data), actual)
}

func requireJSONEq(t *testing.T, expected string, actual any) {
	t.Helper()
	data, err := json.Marshal(actual)
	require.NoError(t, err)
	require.JSONEq(t, expected, string(data), fmt.Sprintf("%T", actual))
}
