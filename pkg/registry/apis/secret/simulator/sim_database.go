package simulator

import (
	"fmt"
	"strconv"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type TransactionID = uint64
type Namespace = string
type SecureValueName = string

// Simulation version of a database used by secrets.
type SimDatabase struct {
	outboxQueue []*secretv0alpha1.SecureValue
	// Map of namespace -> secret name -> secure value
	secretMetadata map[Namespace]map[SecureValueName]secretv0alpha1.SecureValue
	simNetwork     *SimNetwork

	txBuffer map[TransactionID]*transaction

	nextTransactionId uint64
}

type transaction struct {
	outboxQueue    []*secretv0alpha1.SecureValue
	secretMetadata map[Namespace]map[SecureValueName]secretv0alpha1.SecureValue
}

func newTransaction() *transaction {
	return &transaction{
		outboxQueue:    make([]*secretv0alpha1.SecureValue, 0),
		secretMetadata: make(map[Namespace]map[SecureValueName]secretv0alpha1.SecureValue),
	}
}

func NewSimDatabase(simNetwork *SimNetwork) *SimDatabase {
	return &SimDatabase{
		secretMetadata:    make(map[string]map[string]secretv0alpha1.SecureValue),
		simNetwork:        simNetwork,
		txBuffer:          make(map[TransactionID]*transaction),
		nextTransactionId: 1,
	}
}

func (db *SimDatabase) getNextTransactionId() uint64 {
	id := db.nextTransactionId
	db.nextTransactionId += 1
	return id
}

// When a query is received by the database
func (db *SimDatabase) onQuery(query Message) {
	switch query := query.(type) {
	case simDatabaseAppendQuery:
		// TODO: maybe error
		simTx := query.tx.(*simTx)
		transaction := db.txBuffer[simTx.transactionID]
		transaction.outboxQueue = append(transaction.outboxQueue, query.secureValue)

		// Query executed with no errors
		db.simNetwork.Send(simDatabaseAppendResponse{
			cb:  query.cb,
			err: nil,
		})

	case simDatabaseSecretMetadataHasPendingStatusQuery:
		ns, ok := db.secretMetadata[query.namespace.String()]
		if !ok {
			// Namespace doesn't exist
			query.cb(false, nil)
			return
		}

		secureValue, ok := ns[query.name]
		if !ok {
			// Secret doesn't exist
			query.cb(false, nil)
			return
		}

		db.simNetwork.Send(simDatabaseSecretMetadataHasPendingStatusResponse{
			cb:        query.cb,
			isPending: secureValue.Status.Phase == "Pending",
			err:       nil,
		})

	case simDatabaseCreateSecureValueMetadataQuery:
		simTx := query.tx.(*simTx)
		transaction := db.txBuffer[simTx.transactionID]

		v := *query.sv
		v.SetUID(types.UID(uuid.NewString()))
		v.ObjectMeta.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
		v.Spec.Value = ""

		// Check if secret metadata already exists in the database
		ns, ok := db.secretMetadata[query.sv.Namespace]
		if ok {
			if _, ok := ns[query.sv.Name]; ok {
				// Return error if it exists
				db.simNetwork.Send(simDatabaseCreateSecureValueMetadataResponse{
					cb:  query.cb,
					sv:  &v,
					err: fmt.Errorf("securevalue %v already exists", query.sv.Name),
				})
				return
			}
		}

		if _, ok := transaction.secretMetadata[query.sv.Namespace]; !ok {
			transaction.secretMetadata[query.sv.Namespace] = make(map[SecureValueName]secretv0alpha1.SecureValue)
		}

		// Store the secure value metadata in the set of pending changes
		transaction.secretMetadata[query.sv.Namespace][query.sv.Name] = v

		db.simNetwork.Send(simDatabaseCreateSecureValueMetadataResponse{
			cb:  query.cb,
			sv:  &v,
			err: nil,
		})

	case simDatabaseBeginTxQuery:
		transactionId := db.getNextTransactionId()
		db.txBuffer[transactionId] = newTransaction()

		// TODO: begin tx
		db.simNetwork.Send(simDatabaseBeginTxResponse{
			cb:  query.cb,
			tx:  newSimTx(transactionId, db.simNetwork),
			err: nil,
		})

	case simDatabaseCommit:
		simTx := query.tx.(*simTx)
		transaction := db.txBuffer[simTx.transactionID]
		db.outboxQueue = append(db.outboxQueue, transaction.outboxQueue...)
		for namespace, changes := range transaction.secretMetadata {
			for secureValueName, secureValue := range changes {
				// Nil check
				if _, ok := db.secretMetadata[namespace]; !ok {
					db.secretMetadata[namespace] = make(map[SecureValueName]secretv0alpha1.SecureValue)
				}
				db.secretMetadata[namespace][secureValueName] = secureValue
			}
		}
		delete(db.txBuffer, simTx.transactionID)

	case simDatabaseRollback:
		simTx := query.tx.(*simTx)
		delete(db.txBuffer, simTx.transactionID)

	default:
		panic(fmt.Sprintf("unhandled query: %T %+v", query, query))
	}
}

type simTx struct {
	transactionID TransactionID
	network       *SimNetwork
}

func newSimTx(transactionID TransactionID, network *SimNetwork) *simTx {
	return &simTx{transactionID: transactionID, network: network}
}

func (tx *simTx) Commit(func(error)) {
	tx.network.Send(simDatabaseCommit{tx: tx})
}
func (tx *simTx) Rollback(func(error)) {
	tx.network.Send(simDatabaseRollback{tx: tx})
}
