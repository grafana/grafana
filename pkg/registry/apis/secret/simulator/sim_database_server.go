package simulator

import (
	"fmt"
	"slices"
	"strconv"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/assert"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/coro"
	"github.com/mohae/deepcopy"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type TransactionID = uint64
type Namespace = string
type SecureValueName = string

type secureValueMetadata struct {
	namespace string
	name      string
}

type secureValueMetadataRow struct {
	secretv0alpha1.SecureValue
	externalID string
}

// Simulation version of a database server (e.g. mysql) used by secrets.
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
	outboxQueue    []contracts.OutboxMessage
	secretMetadata map[Namespace]map[SecureValueName]*secureValueMetadataRow
}

func newTransaction() *transaction {
	return &transaction{
		outboxQueue:    make([]contracts.OutboxMessage, 0),
		secretMetadata: make(map[Namespace]map[SecureValueName]*secureValueMetadataRow),
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
		return db.secretMetadata[row.namespace][row.name]
	}

	// If it is a transaction, make sure the row is in the transaction read set
	transaction := db.ongoingTransactions[transactionID]
	assert.True(transaction != nil, "transaction not found: transactionID=%+v row=%+v", transactionID, row)

	ns, ok := transaction.secretMetadata[row.namespace]
	if !ok {
		transaction.secretMetadata[row.namespace] = make(map[SecureValueName]*secureValueMetadataRow)
		ns = transaction.secretMetadata[row.namespace]
	}

	if _, ok := ns[row.name]; !ok {
		copy := deepcopy.Copy(*db.secretMetadata[row.namespace][row.name]).(secureValueMetadataRow)
		ns[row.name] = &copy
	}

	return ns[row.name]
}

func (db *SimDatabaseServer) lockRow(transactionID TransactionID, row secureValueMetadata) {
	db.locks[row] = append(db.locks[row], newLock(transactionID, coro.CurrentCoroutine))

	// If some transaction is already holding the lock
	if len(db.locks[row]) > 1 {
		db.activityLog.Record("transaction %+v will wait", transactionID)
		// Yield to the runtime and wait to be woken up. Coroutine should be unblocked when a transaction completes
		if v := coro.YieldAndWait(); v != nil {
			panic(fmt.Sprintf("SimDatabaseServer.Yield resumed with non-nil value, it should always be nil: %+v", v))
		}
		db.activityLog.Record("transaction %+v woken up", transactionID)
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

// When a query is received by the database
func (db *SimDatabaseServer) onQuery(query any) any {
	switch query := query.(type) {
	case simDatabaseAppendQuery:
		// TODO: inject errors
		transaction := db.ongoingTransactions[query.transactionID]
		assert.True(transaction != nil, "transaction not found: query=%T%+v", query, query)

		transaction.outboxQueue = append(transaction.outboxQueue, contracts.OutboxMessage{
			Type:            query.message.Type,
			MessageID:       fmt.Sprintf("message_%d", db.getNextCounter()),
			Name:            query.message.Name,
			Namespace:       query.message.Namespace,
			EncryptedSecret: query.message.EncryptedSecret,
			KeeperType:      query.message.KeeperType,
			ExternalID:      query.message.ExternalID,
		})

		// Query executed with no errors
		return simDatabaseAppendResponse{
			err: nil,
		}

	case simDatabaseOutboxReceive:
		assert.True(query.n > 0, "query.n must be greater than 0")

		return simDatabaseOutboxReceiveResponse{
			messages: db.outboxQueue[:min(uint(len(db.outboxQueue)), query.n)],
			err:      nil,
		}

	case simDatabaseSecretMetadataHasPendingStatusQuery:
		ns, ok := db.secretMetadata[query.namespace.String()]
		if !ok {
			// Namespace doesn't exist
			return simDatabaseSecretMetadataHasPendingStatusResponse{
				isPending: false,
				err:       nil,
			}
		}

		secureValue, ok := ns[query.name]
		if !ok {
			// Secret doesn't exist
			return simDatabaseSecretMetadataHasPendingStatusResponse{
				isPending: false,
				err:       nil,
			}
		}

		return simDatabaseSecretMetadataHasPendingStatusResponse{
			isPending: secureValue.Status.Phase == "Pending",
			err:       nil,
		}

	case simDatabaseCreateSecureValueMetadataQuery:
		assert.True(query.transactionID > 0, "transaction id is missing: transactionID=%+v", query.transactionID)
		transaction := db.ongoingTransactions[query.transactionID]

		v := *query.sv
		v.SetUID(types.UID(uuid.NewString()))
		v.ObjectMeta.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
		v.Spec.Value = ""

		// Lock the row
		db.lockRow(query.transactionID, secureValueMetadata{namespace: query.sv.Namespace, name: query.sv.Name})

		// Check if secret metadata already exists in the database
		ns, ok := db.secretMetadata[query.sv.Namespace]
		if ok {
			if _, ok := ns[query.sv.Name]; ok {
				// Return error if it exists
				return simDatabaseCreateSecureValueMetadataResponse{
					sv:  &v,
					err: fmt.Errorf("securevalue %v already exists: %w", query.sv.Name, contracts.ErrSecureValueAlreadyExists),
				}
			}
		}

		if _, ok := transaction.secretMetadata[query.sv.Namespace]; !ok {
			transaction.secretMetadata[query.sv.Namespace] = make(map[SecureValueName]*secureValueMetadataRow)
		}

		// Store the secure value metadata in the set of pending changes
		transaction.secretMetadata[query.sv.Namespace][query.sv.Name] = &secureValueMetadataRow{
			SecureValue: v,
		}

		return simDatabaseCreateSecureValueMetadataResponse{
			sv:  &v,
			err: nil,
		}

	case simDatabaseBeginTxQuery:
		transactionId := db.getNextTransactionId()
		db.ongoingTransactions[transactionId] = newTransaction()

		return simDatabaseBeginTxResponse{
			transactionID: transactionId,
			err:           nil,
		}

	case simDatabaseCommit:
		transaction := db.ongoingTransactions[query.transactionID]
		db.outboxQueue = append(db.outboxQueue, transaction.outboxQueue...)
		for namespace, changes := range transaction.secretMetadata {
			for secureValueName, secureValue := range changes {
				// Nil check
				if _, ok := db.secretMetadata[namespace]; !ok {
					db.secretMetadata[namespace] = make(map[SecureValueName]*secureValueMetadataRow)
				}
				db.secretMetadata[namespace][secureValueName] = secureValue
			}
		}

		delete(db.ongoingTransactions, query.transactionID)
		db.releaseLocks(query.transactionID)

		return simDatabaseCommitResponse{err: nil}

	case simDatabaseRollback:
		delete(db.ongoingTransactions, query.transactionID)
		db.releaseLocks(query.transactionID)
		return simDatabaseRollbackResponse{err: nil}

	case simDatabaseSetExternalIDQuery:
		row := db.readRow(query.transactionID, secureValueMetadata{namespace: query.namespace.String(), name: query.name})

		row.externalID = query.externalID.String()

		return simDatabaseSetExternalIDResponse{err: nil}

	case simDatabaseSetStatusSucceededQuery:
		fmt.Printf("\n\naaaaaaa query %+v\n\n", query)
		row := db.readRow(query.transactionID, secureValueMetadata{namespace: query.namespace.String(), name: query.name})

		row.Status = secretv0alpha1.SecureValueStatus{Phase: "Succeeded"}

		return simDatabaseSetStatusSucceededResponse{err: nil}

	case simDatabaseOutboxDeleteQuery:
		if query.transactionID > 0 {
			transaction := db.ongoingTransactions[query.transactionID]
			assert.True(transaction != nil, "transaction not found: query=%T%+v", query, query)
			transaction.outboxQueue = slices.DeleteFunc(transaction.outboxQueue, func(message contracts.OutboxMessage) bool { return message.MessageID == query.messageID })
		} else {
			db.outboxQueue = slices.DeleteFunc(db.outboxQueue, func(message contracts.OutboxMessage) bool { return message.MessageID == query.messageID })
		}
		return simDatabaseOutboxDeleteResponse{err: nil}

	default:
		panic(fmt.Sprintf("unhandled query: %T %+v", query, query))
	}
}
