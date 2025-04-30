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
		transactionID, err := simDatabaseServer.QueryBeginTx(ctx)
		require.NoError(t, err)

		require.Nil(t, coro.Yield())

		_, err = simDatabaseServer.QueryCreateSecureValueMetadata(transactionID, &sv)
		require.NoError(t, err)

		require.Nil(t, coro.Yield())

		require.NoError(t, simDatabaseServer.QueryCommitTx(transactionID))
	})
	_ = c1.Resume(nil)

	c2 := runtime.Spawn(func() {
		ctx := context.Background()
		transactionID, err := simDatabaseServer.QueryBeginTx(ctx)
		require.NoError(t, err)

		require.Nil(t, coro.Yield())

		_, err = simDatabaseServer.QueryCreateSecureValueMetadata(transactionID, &sv)
		require.ErrorIs(t, err, contracts.ErrSecureValueAlreadyExists)

		require.Nil(t, coro.Yield())

		// Since an error was returned when creating the secure value metadata, the tx should have been rolled back automatically
		require.Contains(t, simDatabaseServer.QueryCommitTx(transactionID).Error(), "tried to commit a transaction that doesn't exist")
	})
	_ = c2.Resume(nil)

	for len(runtime.ReadySet) > 0 {
		runtime.ReadySet[0].Coroutine.Resume(nil)
	}

	require.Empty(t, runtime.ReadySet)
}

func TestTransaction(t *testing.T) {
	db := NewSimDatabaseServer(NewActivityLog())
	ctx := context.Background()

	// Begin a transaction
	txID, err := db.QueryBeginTx(ctx)
	require.NoError(t, err)

	namespace := "namespace_1"
	name := "name_1"

	_, err = db.QueryOutboxAppend(txID, contracts.AppendOutboxMessage{
		Type:            contracts.CreateSecretOutboxMessage,
		Name:            name,
		Namespace:       namespace,
		EncryptedSecret: secretv0alpha1.NewExposedSecureValue("value_1"),
		ExternalID:      nil})
	require.NoError(t, err)

	sv := &secretv0alpha1.SecureValue{}
	sv.Namespace = namespace
	sv.Name = name

	_, err = db.QueryCreateSecureValueMetadata(txID, sv)
	require.NoError(t, err)

	// There's nothing in the database before the tx is committed
	require.Empty(t, db.outboxQueue)
	require.Empty(t, db.secretMetadata)

	require.NoError(t, db.QueryCommitTx(txID))

	// Data is stored in the db when the tx is committed
	require.NotEmpty(t, db.outboxQueue)
	require.NotEmpty(t, db.secretMetadata)

	// Start a new transaction
	txID, err = db.QueryBeginTx(ctx)
	require.NoError(t, err)

	messages, err := db.QueryOutboxReceive(txID, 10)
	require.NoError(t, err)
	require.Equal(t, 1, len(messages))
	require.Equal(t, namespace, messages[0].Namespace)
	require.Equal(t, name, messages[0].Name)

	// Delete the row
	require.NoError(t, db.QueryOutboxDelete(txID, messages[0].MessageID))

	// The row was not deleted yet since the transaction is not completed yet
	require.NotEmpty(t, db.outboxQueue)

	require.NoError(t, db.QueryCommitTx(txID))

	// The row should have been deleted when the transaction was committed
	require.Empty(t, db.outboxQueue)
}
