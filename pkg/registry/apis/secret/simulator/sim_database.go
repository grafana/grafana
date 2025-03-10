package simulator

import (
	"fmt"
	"strconv"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/simulator/assert"
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

func NewSimDatabase() *SimDatabase {
	return &SimDatabase{
		secretMetadata:    make(map[string]map[string]secretv0alpha1.SecureValue),
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
func (db *SimDatabase) onQuery(query any) any {
	switch query := query.(type) {
	case simDatabaseAppendQuery:
		// TODO: inject errors
		transaction := db.txBuffer[query.transactionID]
		assert.True(transaction != nil, "transaction not found: query=%T%+v", query, query)
		transaction.outboxQueue = append(transaction.outboxQueue, query.secureValue)

		// Query executed with no errors
		return simDatabaseAppendResponse{
			err: nil,
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
		transaction := db.txBuffer[query.transactionID]

		v := *query.sv
		v.SetUID(types.UID(uuid.NewString()))
		v.ObjectMeta.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
		v.Spec.Value = ""

		// Check if secret metadata already exists in the database
		ns, ok := db.secretMetadata[query.sv.Namespace]
		if ok {
			if _, ok := ns[query.sv.Name]; ok {
				// Return error if it exists
				return simDatabaseCreateSecureValueMetadataResponse{
					sv:  &v,
					err: fmt.Errorf("securevalue %v already exists", query.sv.Name),
				}
			}
		}

		fmt.Printf("\n\naaaaaaa query.sv tx=%+v %+v\n\n", transaction, query.sv)
		if _, ok := transaction.secretMetadata[query.sv.Namespace]; !ok {
			transaction.secretMetadata[query.sv.Namespace] = make(map[SecureValueName]secretv0alpha1.SecureValue)
		}

		// Store the secure value metadata in the set of pending changes
		transaction.secretMetadata[query.sv.Namespace][query.sv.Name] = v

		return simDatabaseCreateSecureValueMetadataResponse{
			sv:  &v,
			err: nil,
		}

	case simDatabaseBeginTxQuery:
		transactionId := db.getNextTransactionId()
		db.txBuffer[transactionId] = newTransaction()

		return simDatabaseBeginTxResponse{
			transactionID: transactionId,
			err:           nil,
		}

	case simDatabaseCommit:
		transaction := db.txBuffer[query.transactionID]
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
		delete(db.txBuffer, query.transactionID)
		return simDatabaseCommitResponse{err: nil}

	case simDatabaseRollback:
		delete(db.txBuffer, query.transactionID)
		return simDatabaseRollbackResponse{err: nil}

	default:
		panic(fmt.Sprintf("unhandled query: %T %+v", query, query))
	}
}
