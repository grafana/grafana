package simulator

import (
	"context"
	"fmt"
	"slices"
	"strconv"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/assert"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/coro"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
	"github.com/mitchellh/copystructure"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type TransactionID = uint64
type Namespace = string
type SecureValueName = string

type secureValueMetadata struct {
	Namespace string
	Name      string
}

type secureValueMetadataRow struct {
	secretv0alpha1.SecureValue
	ExternalID string
}

// Simulation version of a database server (e.g. mysql) used by secrets.
// The isolation level is repeatable-read.
type SimDatabaseServer struct {
	activityLog *ActivityLog
	// Simulates the table used to store outbox messages.
	outboxQueue []contracts.OutboxMessage
	// Simulates the table used to store secret metadata. Map of namespace -> secret name -> secure value
	secretMetadata map[Namespace]map[SecureValueName]*secureValueMetadataRow
	// Simulats in-fllight (not yet committed) transactions.
	ongoingTransactions map[TransactionID]*transaction
	// Map of row -> list of coroutines waiting to acquire the lock.
	// The lock is held by the first element in the slice.
	locks map[secureValueMetadata][]lock

	nextTransactionId uint64
	nextCounter       uint64
}

type lock struct {
	transactionID TransactionID
	coroutine     coro.Coroutine
}

func newLock(transactionID TransactionID, coroutine coro.Coroutine) lock {
	return lock{
		transactionID: transactionID,
		coroutine:     coroutine,
	}
}

type transaction struct {
	addToOutboxQueue []contracts.OutboxMessage
	// List of message ids to delete
	deleteFromOutboxQueue []string
	secretMetadata        map[Namespace]map[SecureValueName]*secureValueMetadataRow
}

type transactionOp struct {
	typ                     string
	messageID               string
	secretMetadataNamespace string
	secretMetadataName      string
}

func newTransaction() *transaction {
	return &transaction{
		addToOutboxQueue:      make([]contracts.OutboxMessage, 0),
		deleteFromOutboxQueue: make([]string, 0),
		secretMetadata:        make(map[Namespace]map[SecureValueName]*secureValueMetadataRow),
	}
}

func NewSimDatabaseServer(activityLog *ActivityLog) *SimDatabaseServer {
	return &SimDatabaseServer{
		activityLog:         activityLog,
		secretMetadata:      make(map[string]map[string]*secureValueMetadataRow),
		ongoingTransactions: make(map[TransactionID]*transaction),
		locks:               make(map[secureValueMetadata][]lock),
		nextTransactionId:   1,
		nextCounter:         1,
	}
}

func (db *SimDatabaseServer) getNextTransactionId() uint64 {
	id := db.nextTransactionId
	db.nextTransactionId += 1
	return id
}

func (db *SimDatabaseServer) getNextCounter() uint64 {
	id := db.nextCounter
	db.nextCounter += 1
	return id
}

func (db *SimDatabaseServer) readRow(transactionID TransactionID, row secureValueMetadata) *secureValueMetadataRow {
	// If the row is not being read in a transaction
	if transactionID == 0 {
		return db.secretMetadata[row.Namespace][row.Name]
	}

	// TODO: there's a bug with deleting a secure value and reading
	// If it is a transaction, make sure the row is in the transaction read set
	transaction := db.ongoingTransactions[transactionID]
	assert.True(transaction != nil, "transaction not found: transactionID=%+v row=%+v", transactionID, row)

	ns, ok := transaction.secretMetadata[row.Namespace]
	if !ok {
		transaction.secretMetadata[row.Namespace] = make(map[SecureValueName]*secureValueMetadataRow)
		ns = transaction.secretMetadata[row.Namespace]
	}

	if _, ok := ns[row.Name]; !ok {
		v, err := copystructure.Copy(db.secretMetadata[row.Namespace][row.Name])
		if err != nil {
			panic(fmt.Sprintf("copying database row for transaction: %+v", err))
		}

		clone := v.(*secureValueMetadataRow)

		transaction.secretMetadata[clone.Namespace][clone.Name] = clone
	}

	return transaction.secretMetadata[row.Namespace][row.Name]
}

func (db *SimDatabaseServer) lockRow(transactionID TransactionID, row secureValueMetadata) {
	db.locks[row] = append(db.locks[row], newLock(transactionID, coro.CurrentCoroutine))

	// If some transaction is already holding the lock
	if len(db.locks[row]) > 1 {
		// Yield to the runtime and wait to be woken up. Coroutine should be unblocked when a transaction completes
		if v := coro.YieldAndWait(); v != nil {
			panic(fmt.Sprintf("SimDatabaseServer.Yield resumed with non-nil value, it should always be nil: %+v", v))
		}
	}
}

func (db *SimDatabaseServer) releaseLocks(transactionID TransactionID) {
	for row, locks := range db.locks {
		for i, lock := range locks {
			if lock.transactionID == transactionID {
				// Delete the lock
				db.locks[row] = append(db.locks[row][:i], db.locks[row][i+1:]...)
				// If there's a transaction waiting to lock the row
				if len(db.locks[row]) > 0 {
					// Mark the coroutine as ready to resume
					db.locks[row][0].coroutine.ReadyToResume(nil)
					db.activityLog.Record("releasing lock %+d", lock.transactionID)
				}
				break
			}
		}
	}
}

func (db *SimDatabaseServer) QueryBeginTx(ctx context.Context) (TransactionID, error) {
	transactionId := db.getNextTransactionId()
	db.ongoingTransactions[transactionId] = newTransaction()

	// TODO: inject errors
	return transactionId, nil
}

func (db *SimDatabaseServer) QueryCommitTx(transactionID TransactionID) error {
	transaction, ok := db.ongoingTransactions[transactionID]
	if !ok {
		return fmt.Errorf("tried to commit a transaction that doesn't exist: transactionID=%+v", transactionID)
	}

	db.outboxQueue = append(db.outboxQueue, transaction.addToOutboxQueue...)

	// Create a set of message ids
	toDelete := make(map[string]bool)
	for _, messageID := range transaction.deleteFromOutboxQueue {
		toDelete[messageID] = true
	}

	// Delete the messages that are in the toDelete set
	db.outboxQueue = slices.DeleteFunc(db.outboxQueue, func(m contracts.OutboxMessage) bool {
		return toDelete[m.MessageID]
	})

	for namespace, changes := range transaction.secretMetadata {
		for secureValueName, secureValue := range changes {
			// Nil check
			if _, ok := db.secretMetadata[namespace]; !ok {
				db.secretMetadata[namespace] = make(map[SecureValueName]*secureValueMetadataRow)
			}
			db.secretMetadata[namespace][secureValueName] = secureValue
		}
	}

	delete(db.ongoingTransactions, transactionID)
	db.releaseLocks(transactionID)

	return nil
}

func (db *SimDatabaseServer) QueryRollbackTx(transactionID TransactionID) error {
	delete(db.ongoingTransactions, transactionID)
	db.releaseLocks(transactionID)
	return nil
}

func (db *SimDatabaseServer) QueryOutboxAppend(transactionID TransactionID, message contracts.AppendOutboxMessage) (string, error) {
	transaction := db.ongoingTransactions[transactionID]
	assert.True(transaction != nil, "transaction not found: transactionID=%+v message=%+v", transactionID, message)

	messageID := fmt.Sprintf("message_%d", db.getNextCounter())
	transaction.addToOutboxQueue = append(transaction.addToOutboxQueue, contracts.OutboxMessage{
		Type:            message.Type,
		MessageID:       messageID,
		Name:            message.Name,
		Namespace:       message.Namespace,
		EncryptedSecret: message.EncryptedSecret,
		KeeperName:      message.KeeperName,
		ExternalID:      message.ExternalID,
	})

	// Query executed with no errors
	return messageID, nil
}

func (db *SimDatabaseServer) QueryReadSecureValueMetadata(namespace xkube.Namespace, name string, opts contracts.ReadOpts) (*secretv0alpha1.SecureValue, error) {
	ns, ok := db.secretMetadata[namespace.String()]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}

	row, ok := ns[name]
	if !ok {
		return nil, contracts.ErrSecureValueNotFound
	}

	// TODO: implement opts.ForUpdate

	return &row.SecureValue, nil
}

func (db *SimDatabaseServer) QueryOutboxReceive(transactionID TransactionID, n uint) ([]contracts.OutboxMessage, error) {
	// TODO: lock row
	assert.True(n > 0, "n must be greater than 0")

	messages := db.outboxQueue[:min(uint(len(db.outboxQueue)), n)]

	// Clone the messages to avoid issues since slices.DeleteFunc is being used
	// in other places and it zeroes elements that are removed from a slice.
	return slices.Clone(messages), nil
}

func (db *SimDatabaseServer) QueryOutboxDelete(transactionID TransactionID, messageID string) error {
	if transactionID > 0 {
		transaction := db.ongoingTransactions[transactionID]
		assert.True(transaction != nil, "transaction not found: transactionID=%+v", transactionID)
		transaction.deleteFromOutboxQueue = append(transaction.deleteFromOutboxQueue, messageID)
	} else {
		db.outboxQueue = slices.DeleteFunc(db.outboxQueue, func(message contracts.OutboxMessage) bool { return message.MessageID == messageID })
	}

	return nil
}

func (db *SimDatabaseServer) QueryCreateSecureValueMetadata(transactionID TransactionID, sv *secretv0alpha1.SecureValue) (*secretv0alpha1.SecureValue, error) {
	assert.True(transactionID > 0, "transaction id is missing: transactionID=%+v", transactionID)
	transaction := db.ongoingTransactions[transactionID]

	v := *sv
	v.SetUID(types.UID(uuid.NewString()))
	v.ObjectMeta.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
	v.Spec.Value = ""

	// Lock the row
	db.lockRow(transactionID, secureValueMetadata{Namespace: sv.Namespace, Name: sv.Name})

	// Check if secret metadata already exists in the database
	ns, ok := db.secretMetadata[sv.Namespace]
	if ok {
		if _, ok := ns[sv.Name]; ok {
			// Rollback on error
			if err := db.QueryRollbackTx(transactionID); err != nil {
				panic(fmt.Sprintf("rolling tx back after error happened while creating secure value metadata: %+v", err))
			}
			// Return error if it exists
			return nil, fmt.Errorf("securevalue %v already exists: %w", sv.Name, contracts.ErrSecureValueAlreadyExists)
		}
	}

	if _, ok := transaction.secretMetadata[sv.Namespace]; !ok {
		transaction.secretMetadata[sv.Namespace] = make(map[SecureValueName]*secureValueMetadataRow)
	}

	// Store the secure value metadata in the set of pending changes
	transaction.secretMetadata[sv.Namespace][sv.Name] = &secureValueMetadataRow{
		SecureValue: v,
	}

	return &v, nil
}

func (db *SimDatabaseServer) QueryDeleteSecureValueMetadata(namespace xkube.Namespace, name string) error {
	// Check if secure value metadata already exists in the database
	ns, ok := db.secretMetadata[namespace.String()]
	if ok {
		// Delete the secure value metadata
		delete(ns, name)
	}
	return nil
}

func (db *SimDatabaseServer) QuerySetExternalID(transactionID TransactionID, namespace xkube.Namespace, name string, externalID contracts.ExternalID) error {
	row := db.readRow(transactionID, secureValueMetadata{Namespace: namespace.String(), Name: name})
	row.ExternalID = externalID.String()
	return nil
}

func (db *SimDatabaseServer) QuerySetStatus(transactionID TransactionID, namespace xkube.Namespace, name string, status secretv0alpha1.SecureValueStatus) error {
	row := db.readRow(transactionID, secureValueMetadata{Namespace: namespace.String(), Name: name})

	row.Status = status

	return nil
}
