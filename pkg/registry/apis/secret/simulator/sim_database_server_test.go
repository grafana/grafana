package simulator

import (
	"context"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/coro"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func TestRowLocks(t *testing.T) {
	t.Parallel()

	simDatabaseServer := NewSimDatabaseServer(NewActivityLog())

	runtime := coro.NewRuntime()

	sv := secretv0alpha1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Namespace: "foo",
			Name:      "a",
		},
	}

	c1 := runtime.Spawn(func() {
		ctx := context.Background()
		response := simDatabaseServer.onQuery(simDatabaseBeginTxQuery{ctx: ctx, opts: nil}).(simDatabaseBeginTxResponse)

		require.Nil(t, coro.Yield())

		createSvResponse := simDatabaseServer.onQuery(simDatabaseCreateSecureValueMetadataQuery{
			ctx: ctx, sv: &sv, transactionID: response.transactionID,
		}).(simDatabaseCreateSecureValueMetadataResponse)
		require.NoError(t, createSvResponse.err)

		require.Nil(t, coro.Yield())

		simDatabaseServer.onQuery(simDatabaseCommit{transactionID: response.transactionID})
	})
	_ = c1.Resume(nil)

	c2 := runtime.Spawn(func() {
		ctx := context.Background()
		response := simDatabaseServer.onQuery(simDatabaseBeginTxQuery{ctx: ctx, opts: nil}).(simDatabaseBeginTxResponse)

		require.Nil(t, coro.Yield())

		createSvResponse := simDatabaseServer.onQuery(simDatabaseCreateSecureValueMetadataQuery{
			ctx: ctx, sv: &sv, transactionID: response.transactionID,
		}).(simDatabaseCreateSecureValueMetadataResponse)
		require.ErrorIs(t, createSvResponse.err, contracts.ErrSecureValueAlreadyExists)

		require.Nil(t, coro.Yield())

		simDatabaseServer.onQuery(simDatabaseCommit{transactionID: response.transactionID})
	})
	_ = c2.Resume(nil)

	for len(runtime.ReadySet) > 0 {
		runtime.ReadySet[0].Coroutine.Resume(nil)
	}

	require.Empty(t, runtime.ReadySet)
}
