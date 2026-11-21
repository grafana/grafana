package teamdelete

import (
	"context"
	"errors"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestDeletedRegistryRun(t *testing.T) {
	registry := ProvideDeletedRegistry()
	var ran []string
	registry.RegisterDeleted(func(context.Context, Deleted) error {
		ran = append(ran, "error")
		return errors.New("handler failed")
	})
	registry.RegisterDeleted(func(context.Context, Deleted) error {
		ran = append(ran, "panic")
		panic("boom")
	})
	registry.RegisterDeleted(func(_ context.Context, d Deleted) error {
		ran = append(ran, "after "+d.TeamUID)
		return nil
	})

	require.NotPanics(t, func() { registry.Run(context.Background(), Deleted{OrgID: 1, TeamID: 2, TeamUID: "uid"}) })
	require.Equal(t, []string{"error", "panic", "after uid"}, ran)
}

func TestDeletedRegistryRunIgnoresCancelledContext(t *testing.T) {
	registry := ProvideDeletedRegistry()
	var ctxErr error
	registry.RegisterDeleted(func(ctx context.Context, _ Deleted) error {
		ctxErr = ctx.Err()
		return nil
	})
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	registry.Run(ctx, Deleted{})
	require.NoError(t, ctxErr)
}
