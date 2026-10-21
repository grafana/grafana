package metadata

import (
	"context"
	"fmt"
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

func TestIntegration_LeaseInactiveSecureValuesDoesNotBlockOnUnselectedRow(t *testing.T) {
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))
	tracer := noop.NewTracerProvider().Tracer("test")
	db := database.ProvideDatabase(testDB, tracer)

	s, err := ProvideSecureValueMetadataStorage(clock.ProvideClock(), db, tracer, nil)
	require.NoError(t, err)

	createdAt := time.Now().Add(-15 * time.Minute).UTC().Unix()

	ids := make([]string, 2)
	for i := range 2 {
		sv := &secretv1beta1.SecureValue{}
		sv.Name = fmt.Sprintf("sv-%d", i)
		sv.Namespace = "ns"

		created, err := s.Create(t.Context(), contracts.SystemKeeperName, sv, "actor")
		require.NoError(t, err)

		require.NoError(t, s.SetVersionToInactive(t.Context(), xkube.Namespace(created.Namespace), created.Name, created.Status.Version))

		ids[i] = string(created.UID)

		// Make both values old enough for GC, with distinct creation times so a batch of one selects ids[0].
		_, err = db.ExecContext(t.Context(), "UPDATE secret_secure_value SET created = ?, updated = ? WHERE guid = ?", createdAt+int64(i), createdAt+int64(i), ids[i])
		require.NoError(t, err)
	}

	// Keep a separate transaction open on the newer value while GC tries to lease the older one.
	tx, err := testDB.GetEngine().DB().DB.BeginTx(t.Context(), nil)
	require.NoError(t, err)
	defer func() { _ = tx.Rollback() }()

	lockQuery := "SELECT guid FROM secret_secure_value WHERE guid = ? FOR UPDATE"
	switch db.DriverName() {
	case "postgres":
		lockQuery = "SELECT guid FROM secret_secure_value WHERE guid = $1 FOR UPDATE"
	case "sqlite3":
		lockQuery = "SELECT guid FROM secret_secure_value WHERE guid = ?"
	}

	var locked string
	require.NoError(t, tx.QueryRowContext(t.Context(), lockQuery, ids[1]).Scan(&locked))

	// Leasing must complete while the other transaction is still open.
	// The old MySQL window query also locked unselected rows and blocked here.
	ctx, cancel := context.WithTimeout(t.Context(), 10*time.Second)
	defer cancel()

	values, err := s.LeaseInactiveSecureValues(ctx, 1)
	require.NoError(t, err)
	require.Len(t, values, 1)
	require.Equal(t, ids[0], string(values[0].UID))

	// Release the competing transaction, then check that the newer value remains available
	// and the older value is still excluded by its existing lease.
	require.NoError(t, tx.Rollback())

	values, err = s.LeaseInactiveSecureValues(ctx, 1)
	require.NoError(t, err)
	require.Len(t, values, 1)
	require.Equal(t, ids[1], string(values[0].UID))
}

func TestIntegration_LeaseCandidatesRechecksLease(t *testing.T) {
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

	// Evaluate leases past the GC grace period so the inactive value is eligible.
	now := time.Now().Add(15 * time.Minute).UTC().Unix()

	// Model two workers selecting the same value before either acquires a lease.
	candidatesA, err := s.listLeaseCandidates(t.Context(), 10, now)
	require.NoError(t, err)
	candidatesB, err := s.listLeaseCandidates(t.Context(), 10, now)
	require.NoError(t, err)
	require.Equal(t, []string{string(created.UID)}, candidatesA)
	require.Equal(t, candidatesA, candidatesB)

	// Worker A claims the value, making worker B's previously selected candidates stale.
	affected, err := s.leaseCandidates(t.Context(), "token-a", candidatesA, now)
	require.NoError(t, err)
	require.Equal(t, int64(1), affected)

	// Acquiring from a stale selection must recheck lease expiry and preserve worker A's lease.
	affected, err = s.leaseCandidates(t.Context(), "token-b", candidatesB, now)
	require.NoError(t, err)
	require.Equal(t, int64(0), affected)

	// Confirm the stored lease still belongs exclusively to worker A.
	leasedA, err := s.listByLeaseToken(t.Context(), "token-a")
	require.NoError(t, err)
	require.Len(t, leasedA, 1)

	leasedB, err := s.listByLeaseToken(t.Context(), "token-b")
	require.NoError(t, err)
	require.Empty(t, leasedB)

	// Reactivate the value, then retry the stale candidate after worker A's lease expires.
	// The UPDATE must also recheck active state so worker C cannot claim it.
	require.NoError(t, s.SetVersionToActive(t.Context(), xkube.Namespace(created.Namespace), created.Name, created.Status.Version))
	affected, err = s.leaseCandidates(t.Context(), "token-c", candidatesA, now+int64(time.Hour.Seconds()))
	require.NoError(t, err)
	require.Equal(t, int64(0), affected)
}
