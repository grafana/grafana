package metadata

import (
	"context"
	"fmt"
	"math/rand"
	"slices"
	"testing"
	"time"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/storage/secret/migrator"
	"github.com/stretchr/testify/require"
)

type outboxStoreModel struct {
	rows []contracts.OutboxMessage
}

func newOutboxStoreModel() *outboxStoreModel {
	return &outboxStoreModel{}
}

func (model *outboxStoreModel) Append(messageID string, message contracts.AppendOutboxMessage) {
	model.rows = append(model.rows, contracts.OutboxMessage{
		Type:            message.Type,
		MessageID:       messageID,
		Name:            message.Name,
		Namespace:       message.Namespace,
		EncryptedSecret: message.EncryptedSecret,
		KeeperName:      message.KeeperName,
		ExternalID:      message.ExternalID,
	})
}

func (model *outboxStoreModel) ReceiveN(n uint) []contracts.OutboxMessage {
	maxMessages := min(len(model.rows), int(n))
	if maxMessages == 0 {
		return []contracts.OutboxMessage{}
	}
	return model.rows[:maxMessages]
}

func (model *outboxStoreModel) Delete(messageID string) {
	oldLen := len(model.rows)
	model.rows = slices.DeleteFunc(model.rows, func(m contracts.OutboxMessage) bool {
		return m.MessageID == messageID
	})
	if len(model.rows) != oldLen-1 {
		panic("Delete: deleted more than one message")
	}
}

func TestOutboxStoreModel(t *testing.T) {
	t.Parallel()

	model := newOutboxStoreModel()

	require.Empty(t, model.ReceiveN(10))

	appendOutboxMessage := contracts.AppendOutboxMessage{
		Type:            contracts.CreateSecretOutboxMessage,
		Name:            "s-1",
		Namespace:       "n-1",
		EncryptedSecret: secretv0alpha1.NewExposedSecureValue("value"),
		ExternalID:      nil,
	}

	outboxMessage1 := contracts.OutboxMessage{
		MessageID:       "message_id_1",
		Type:            contracts.CreateSecretOutboxMessage,
		Name:            "s-1",
		Namespace:       "n-1",
		EncryptedSecret: secretv0alpha1.NewExposedSecureValue("value"),
		ExternalID:      nil,
	}

	outboxMessage2 := contracts.OutboxMessage{
		MessageID:       "message_id_2",
		Type:            contracts.CreateSecretOutboxMessage,
		Name:            "s-1",
		Namespace:       "n-1",
		EncryptedSecret: secretv0alpha1.NewExposedSecureValue("value"),
		ExternalID:      nil,
	}

	model.Append("message_id_1", appendOutboxMessage)

	require.Equal(t, []contracts.OutboxMessage{outboxMessage1}, model.ReceiveN(10))

	model.Append("message_id_2", appendOutboxMessage)

	require.Equal(t, []contracts.OutboxMessage{outboxMessage1, outboxMessage2}, model.ReceiveN(10))

	model.Delete(outboxMessage1.MessageID)

	require.Equal(t, []contracts.OutboxMessage{outboxMessage2}, model.ReceiveN(5))

	model.Delete(outboxMessage2.MessageID)

	require.Empty(t, model.ReceiveN(1))
}

func TestOutboxStore(t *testing.T) {
	testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))

	ctx := context.Background()

	outbox := ProvideOutboxQueue(testDB)

	m1 := contracts.AppendOutboxMessage{
		Type:            contracts.CreateSecretOutboxMessage,
		Name:            "s-1",
		Namespace:       "n-1",
		EncryptedSecret: secretv0alpha1.NewExposedSecureValue("value"),
		ExternalID:      nil,
	}
	m2 := contracts.AppendOutboxMessage{
		Type:            contracts.CreateSecretOutboxMessage,
		Name:            "s-1",
		Namespace:       "n-2",
		EncryptedSecret: secretv0alpha1.NewExposedSecureValue("value"),
		ExternalID:      nil,
	}

	messages, err := outbox.ReceiveN(ctx, 10)
	require.NoError(t, err)
	require.Empty(t, messages)

	messageID1, err := outbox.Append(ctx, m1)
	require.NoError(t, err)

	for range 2 {
		messages, err = outbox.ReceiveN(ctx, 10)
		require.NoError(t, err)
		require.Equal(t, 1, len(messages))
		require.Equal(t, messageID1, messages[0].MessageID)
	}

	messageID2, err := outbox.Append(ctx, m2)
	require.NoError(t, err)

	messages, err = outbox.ReceiveN(ctx, 3)
	require.NoError(t, err)
	require.Equal(t, 2, len(messages))
	require.Equal(t, messageID1, messages[0].MessageID)
	require.Equal(t, messageID2, messages[1].MessageID)

	require.NoError(t, outbox.Delete(ctx, messageID1))
	messages, err = outbox.ReceiveN(ctx, 10)
	require.NoError(t, err)
	require.Equal(t, 1, len(messages))
	require.Equal(t, messageID2, messages[0].MessageID)

	require.NoError(t, outbox.Delete(ctx, messageID2))

	messages, err = outbox.ReceiveN(ctx, 100)
	require.NoError(t, err)
	require.Empty(t, messages)
}

func TestOutboxStoreProperty(t *testing.T) {
	seed := time.Now().UnixMicro()
	rng := rand.New(rand.NewSource(seed))

	defer func() {
		if err := recover(); err != nil || t.Failed() {
			fmt.Printf("TestOutboxStoreProperty: err=%+v\n\nSEED=%+v", err, seed)
			t.FailNow()
		}
	}()

	// The number of iterations was decided arbitrarily based on the time the test takes to run
	for range 10 {
		testDB := sqlstore.NewTestStore(t, sqlstore.WithMigrator(migrator.New()))

		outbox := ProvideOutboxQueue(testDB)

		model := newOutboxStoreModel()

		ctx := context.Background()

		for i := range 100 {
			n := rng.Intn(3)
			switch n {
			case 0:
				message := contracts.AppendOutboxMessage{
					Type:            contracts.CreateSecretOutboxMessage,
					Name:            fmt.Sprintf("s-%d", i),
					Namespace:       fmt.Sprintf("n-%d", i),
					EncryptedSecret: secretv0alpha1.NewExposedSecureValue("value"),
					ExternalID:      nil,
				}
				messageID, err := outbox.Append(ctx, message)
				require.NoError(t, err)

				model.Append(messageID, message)

			case 1:
				n := uint(rng.Intn(10))
				messages, err := outbox.ReceiveN(ctx, n)
				require.NoError(t, err)

				modelMessages := model.ReceiveN(n)

				require.Equal(t, len(modelMessages), len(messages))
				require.Equal(t, modelMessages, messages)

			case 2:
				if len(model.rows) == 0 {
					continue
				}

				message := model.rows[rng.Intn(len(model.rows))]

				model.Delete(message.MessageID)
				require.NoError(t, outbox.Delete(ctx, message.MessageID))

			default:
				panic(fmt.Sprintf("unhandled action: %+v", n))
			}
		}
	}
}
