package source_test

import (
	"context"
	"errors"
	"sync"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source"
	"github.com/grafana/grafana/apps/provisioning/pkg/repository/source/sourceserver"
	sourcev1 "github.com/grafana/grafana/apps/provisioning/pkg/source/v1"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

type fakeExchanger struct {
	mu    sync.Mutex
	token string
	err   error
	calls [][2]string
}

func (f *fakeExchanger) Exchange(_ context.Context, namespace, audience string) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.calls = append(f.calls, [2]string{namespace, audience})
	return f.token, f.err
}

// buildWith builds a source repository from a spec the caller adjusts.
func buildWith(e repository.Extra, url string, mutate func(*provisioning.Repository)) (repository.Repository, error) {
	repo := &provisioning.Repository{Spec: provisioning.RepositorySpec{
		Type:   provisioning.SourceRepositoryType,
		Source: &provisioning.SourceRepositoryConfig{URL: url},
	}}
	repo.Name, repo.Namespace = "src", "stacks-1"
	repo.Secure.Token = common.InlineSecureValue{Create: token}
	mutate(repo)
	return e.Build(context.Background(), repo)
}

func TestAuthModes(t *testing.T) {
	files := manifests("a.yaml", "a")

	t.Run("tokenExchange exchanges per request for the namespace and the api group", func(t *testing.T) {
		// The source accepts the exchanged token sent in X-Access-Token.
		_, url, _ := startSource(t, sourceserver.Options{Token: "exchanged"}, files)
		ex := &fakeExchanger{token: "exchanged"}

		repo, err := buildWith(source.Extra(fakeDecrypter, true, nil, source.WithTokenExchanger(ex)), url, func(r *provisioning.Repository) {
			r.Spec.Source.Auth = &provisioning.SourceAuth{Type: provisioning.SourceAuthTokenExchange}
		})
		require.NoError(t, err)

		_, err = repo.(repository.Reader).ReadTree(context.Background(), "")
		require.NoError(t, err)
		require.NotEmpty(t, ex.calls)
		for _, call := range ex.calls {
			assert.Equal(t, [2]string{"stacks-1", sourcev1.Group}, call)
		}
	})

	t.Run("tokenExchange is unavailable without an exchanger", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{}, files)
		_, err := buildWith(source.Extra(fakeDecrypter, true, nil), url, func(r *provisioning.Repository) {
			r.Spec.Source.Auth = &provisioning.SourceAuth{Type: provisioning.SourceAuthTokenExchange}
		})
		assert.ErrorContains(t, err, "not available")
	})

	t.Run("a failed exchange fails the request", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{Token: "exchanged"}, files)
		ex := &fakeExchanger{err: errors.New("exchange down")}

		_, err := buildWith(source.Extra(fakeDecrypter, true, nil, source.WithTokenExchanger(ex)), url, func(r *provisioning.Repository) {
			r.Spec.Source.Auth = &provisioning.SourceAuth{Type: provisioning.SourceAuthTokenExchange}
		})
		assert.ErrorContains(t, err, "exchange down")
	})

	t.Run("clientCredentials reads the token the connection controller keeps fresh", func(t *testing.T) {
		_, url, _ := startSource(t, sourceserver.Options{Token: "minted"}, files)

		repo, err := buildWith(newExtra(), url, func(r *provisioning.Repository) {
			r.Spec.Source.Auth = &provisioning.SourceAuth{Type: provisioning.SourceAuthClientCredentials}
			r.Spec.Connection = &provisioning.ConnectionInfo{Name: "remote"}
			r.Secure.Token = common.InlineSecureValue{Create: "minted"}
		})
		require.NoError(t, err)

		_, err = repo.(repository.Reader).ReadTree(context.Background(), "")
		assert.NoError(t, err)
	})
}

func TestEmptyTreeIsRefusedWhenItWouldPruneEverything(t *testing.T) {
	managing := func(r *provisioning.Repository) {
		r.Status.Stats = []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 2}}
	}

	tests := []struct {
		name    string
		mutate  func(*provisioning.Repository)
		refused bool
	}{
		{"a repository that manages resources", managing, true},
		{"a new repository has nothing to prune", func(*provisioning.Repository) {}, false},
		{"allowed on purpose", func(r *provisioning.Repository) {
			managing(r)
			r.Spec.Source.EmptyTreePolicy = provisioning.SourceEmptyTreeAllow
		}, false},
		{"refuse is the explicit default", func(r *provisioning.Repository) {
			managing(r)
			r.Spec.Source.EmptyTreePolicy = provisioning.SourceEmptyTreeRefuse
		}, true},
		{"stats that count nothing", func(r *provisioning.Repository) {
			r.Status.Stats = []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards"}}
		}, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, url, _ := startSource(t, sourceserver.Options{}, nil)

			repo, err := buildWith(newExtra(), url, tt.mutate)
			require.NoError(t, err)
			tree, err := repo.(repository.Reader).ReadTree(context.Background(), "")

			if tt.refused {
				assert.ErrorIs(t, err, source.ErrEmptyTree)
				return
			}
			require.NoError(t, err)
			assert.Empty(t, tree)
		})
	}
}

func TestEmptyTreeIsRefusedOnTheComparePathToo(t *testing.T) {
	managing := func(r *provisioning.Repository) {
		r.Status.Stats = []provisioning.ResourceCount{{Group: "dashboard.grafana.app", Resource: "dashboards", Count: 2}}
	}

	for name, tier := range map[string]sourceserver.Tier{"history": sourceserver.TierHistory, "compare": sourceserver.TierCompare} {
		t.Run(name, func(t *testing.T) {
			srv, url, _ := startSource(t, sourceserver.Options{Tier: tier}, nil)
			base := srv.Publish(manifests("a.yaml", "a", "b.yaml", "b"))
			empty := srv.Publish(nil)
			partial := srv.Publish(manifests("a.yaml", "a"))

			repo, err := buildWith(newExtra(), url, managing)
			require.NoError(t, err)
			versioned := repo.(repository.Versioned)

			_, err = versioned.CompareFiles(context.Background(), base, empty)
			assert.ErrorIs(t, err, source.ErrEmptyTree)

			changes, err := versioned.CompareFiles(context.Background(), base, partial)
			require.NoError(t, err, "deleting some files is an ordinary change")
			assert.Len(t, changes, 1)

			allowed, err := buildWith(newExtra(), url, func(r *provisioning.Repository) {
				managing(r)
				r.Spec.Source.EmptyTreePolicy = provisioning.SourceEmptyTreeAllow
			})
			require.NoError(t, err)
			changes, err = allowed.(repository.Versioned).CompareFiles(context.Background(), base, empty)
			require.NoError(t, err)
			assert.Len(t, changes, 2, "allowed on purpose")
		})
	}
}
