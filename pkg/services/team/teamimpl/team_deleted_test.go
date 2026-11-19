package teamimpl

import (
	"context"
	"errors"
	"testing"

	"github.com/open-feature/go-sdk/openfeature"
	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/infra/tracing"
	iamapi "github.com/grafana/grafana/pkg/registry/apis/iam"
	"github.com/grafana/grafana/pkg/services/team"
	"github.com/grafana/grafana/pkg/services/team/teamdelete"
	"github.com/grafana/grafana/pkg/services/team/teamtest"
)

type deleteStore struct {
	store
	uid string
	err error
}

func (s *deleteStore) Delete(context.Context, *team.DeleteTeamCommand) (string, error) {
	return s.uid, s.err
}

// deleteK8sService records deletes.
type deleteK8sService struct {
	teamtest.FakeService
	deletes   int
	deleteErr error
}

func (s *deleteK8sService) DeleteTeam(context.Context, *team.DeleteTeamCommand) error {
	s.deletes++
	return s.deleteErr
}

func TestDeleteTeamDeletedHandlers(t *testing.T) {
	client := newStackRedirectClient(t)
	deleteErr := errors.New("delete failed")

	tests := []struct {
		name         string
		targetingKey string
		legacyErr    error
		wantErr      error
		wantRuns     int
		wantK8s      int
	}{
		{name: "legacy path", targetingKey: "disabled", wantRuns: 1},
		{name: "legacy failure skips handlers", targetingKey: "disabled", legacyErr: deleteErr, wantErr: deleteErr},
		// The Team API storage runs the handlers on the redirect path.
		{name: "k8s path leaves the handlers to the storage", targetingKey: "enabled", wantK8s: 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			k8s := &deleteK8sService{}
			registry := teamdelete.ProvideDeletedRegistry()
			service := &Service{
				openFeatureClient: client,
				iamFeatures:       iamapi.Features{UsersAPI: true},
				k8sService:        k8s,
				legacyService:     &LegacyService{store: &deleteStore{uid: "legacy-uid", err: tt.legacyErr}, tracer: tracing.InitializeTracerForTest()},
				logger:            log.NewNopLogger(),
				deleted:           registry,
			}
			var got []teamdelete.Deleted
			for range 2 {
				registry.RegisterDeleted(func(_ context.Context, d teamdelete.Deleted) error {
					got = append(got, d)
					return nil
				})
			}
			ctx := openfeature.WithTransactionContext(context.Background(), openfeature.NewEvaluationContext(tt.targetingKey, nil))

			err := service.DeleteTeam(ctx, &team.DeleteTeamCommand{OrgID: 2, ID: 11})
			if tt.wantErr != nil {
				require.ErrorIs(t, err, tt.wantErr)
			} else {
				require.NoError(t, err)
			}
			want := teamdelete.Deleted{OrgID: 2, TeamID: 11, TeamUID: "legacy-uid"}
			if tt.wantRuns == 0 {
				require.Empty(t, got)
			} else {
				require.Equal(t, []teamdelete.Deleted{want, want}, got)
			}
			require.Equal(t, tt.wantK8s, k8s.deletes)
		})
	}
}
