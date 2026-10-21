package metadata

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
	"go.opentelemetry.io/otel/trace/noop"

	secretv1beta1 "github.com/grafana/grafana/apps/secret/pkg/apis/secret/v1beta1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/clock"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/database"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
)

func TestLeaseCandidatesRechecksLease(t *testing.T) {
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	tracer := noop.NewTracerProvider().Tracer("test")
	db := database.ProvideDatabase(testDB, tracer)

	storage, err := ProvideSecureValueMetadataStorage(clock.ProvideClock(), db, tracer, nil)
	require.NoError(t, err)
	s := storage.(*secureValueMetadataStorage)

	sv := &secretv1beta1.SecureValue{
		Spec: secretv1beta1.SecureValueSpec{
			Description: "desc",
			Value:       new(secretv1beta1.NewExposedSecureValue("value")),
		},
	}
	sv.Name = "sv"
	sv.Namespace = "ns"

	created, err := s.Create(t.Context(), contracts.SystemKeeperName, sv, "actor")
	require.NoError(t, err)
	require.NoError(t, s.SetVersionToInactive(t.Context(), xkube.Namespace(created.Namespace), created.Name, created.Status.Version))

	now := time.Now().Add(15 * time.Minute).UTC().Unix()

	candidatesA, err := s.listLeaseCandidates(t.Context(), 10, now)
	require.NoError(t, err)
	candidatesB, err := s.listLeaseCandidates(t.Context(), 10, now)
	require.NoError(t, err)
	require.Equal(t, []string{string(created.UID)}, candidatesA)
	require.Equal(t, candidatesA, candidatesB)

	affected, err := s.leaseCandidates(t.Context(), "token-a", candidatesA, now)
	require.NoError(t, err)
	require.Equal(t, int64(1), affected)

	affected, err = s.leaseCandidates(t.Context(), "token-b", candidatesB, now)
	require.NoError(t, err)
	require.Equal(t, int64(0), affected)

	leasedA, err := s.listByLeaseToken(t.Context(), "token-a")
	require.NoError(t, err)
	require.Len(t, leasedA, 1)

	leasedB, err := s.listByLeaseToken(t.Context(), "token-b")
	require.NoError(t, err)
	require.Empty(t, leasedB)

	require.NoError(t, s.SetVersionToActive(t.Context(), xkube.Namespace(created.Namespace), created.Name, created.Status.Version))
	affected, err = s.leaseCandidates(t.Context(), "token-c", candidatesA, now+int64(time.Hour.Seconds()))
	require.NoError(t, err)
	require.Equal(t, int64(0), affected)
}
