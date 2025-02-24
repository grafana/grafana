package simulator

import (
	"fmt"
	"strconv"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

type TransactionID = string
type Namespace = string
type SecureValueName = string

// Simulation version of a database used by secrets.
type SimDatabase struct {
	outboxQueue []any
	// Map of namespace -> secret name -> secure value
	secretMetadata map[Namespace]map[SecureValueName]secretv0alpha1.SecureValue
	simNetwork     *SimNetwork

	txBuffer map[TransactionID]map[Namespace]map[SecureValueName]secretv0alpha1.SecureValue
}

func NewSimDatabase(simNetwork *SimNetwork) *SimDatabase {
	return &SimDatabase{
		secretMetadata: make(map[string]map[string]secretv0alpha1.SecureValue),
		simNetwork:     simNetwork,
	}
}

// When a query is received by the database
func (db *SimDatabase) onQuery(query Message) {
	switch query := query.(type) {
	case simDatabaseAppendQuery:
		// TODO: maybe error
		db.outboxQueue = append(db.outboxQueue, query.foo)
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
		v := *query.sv
		v.SetUID(types.UID(uuid.NewString()))
		v.ObjectMeta.SetResourceVersion(strconv.FormatInt(metav1.Now().UnixMicro(), 10))
		v.Spec.Value = ""

		ns, ok := db.secretMetadata[query.sv.Namespace]
		if !ok {
			ns = make(map[string]secretv0alpha1.SecureValue)
			db.secretMetadata[query.sv.Namespace] = ns
		}

		if _, ok := ns[query.sv.Name]; ok {
			db.simNetwork.Send(simDatabaseCreateSecureValueMetadataResponse{
				cb:  query.cb,
				sv:  &v,
				err: fmt.Errorf("securevalue %v already exists", query.sv.Name),
			})
			return
		}

		ns[query.sv.Name] = v

		db.simNetwork.Send(simDatabaseCreateSecureValueMetadataResponse{
			cb:  query.cb,
			sv:  &v,
			err: nil,
		})

	case simDatabaseBeginTxQuery:
		db.simNetwork.Send(simDatabaseBeginTxResponse{
			cb:  query.cb,
			tx:  tx,
			err: nil,
		})

	default:
		panic(fmt.Sprintf("unhandled query: %T %+v", query, query))
	}
}
