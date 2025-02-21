package simulator

import (
	"fmt"
	"strconv"

	"github.com/google/uuid"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/types"
)

// Simulation version of a database used by secrets.
type SimDatabase struct {
	outboxQueue []any
	// Map of namespace -> secret name -> secure value
	secretMetadata map[string]map[string]secretv0alpha1.SecureValue
}

func NewSimDatabase() *SimDatabase {
	return &SimDatabase{
		secretMetadata: make(map[string]map[string]secretv0alpha1.SecureValue),
	}
}

// When a query to append a message to the outbox queue is received
func (db *SimDatabase) onQuery(query Message) {
	switch query := query.(type) {
	case simDatabaseAppendQuery:
		// TODO: maybe error
		db.outboxQueue = append(db.outboxQueue, query.foo)
		// Query executed with no errors
		query.cb(nil)

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

		query.cb(secureValue.Status.Phase == "Pending", nil)

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
		ns[query.sv.Name] = v
		query.cb(&v, nil)

	default:
		panic(fmt.Sprintf("unhandled query: %T %+v", query, query))
	}
}
