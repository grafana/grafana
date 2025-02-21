package simulator

import (
	"context"
	"fmt"
	"math/rand"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/infra/db"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

// Simulation version of the network which requests go through.
type SimNetwork struct {
	rng *rand.Rand
	// The set of messages in flgith
	messages    []Message
	simDatabase *SimDatabase
}

func NewSimNetwork(rng *rand.Rand, simDatabase *SimDatabase) *SimNetwork {
	return &SimNetwork{rng: rng, simDatabase: simDatabase}
}

type Message interface {
	Message()
}

type simDatabaseAppendQuery struct {
	ctx context.Context
	tx  *db.Session
	foo any
	cb  func(error)
}

func (simDatabaseAppendQuery) Message() {}

type simDatabaseSecretMetadataHasPendingStatusQuery struct {
	ctx       context.Context
	tx        *db.Session
	namespace xkube.Namespace
	name      string
	cb        func(bool, error)
}

func (simDatabaseSecretMetadataHasPendingStatusQuery) Message() {}

type simDatabaseCreateSecureValueMetadataQuery struct {
	ctx context.Context
	tx  *db.Session
	sv  *secretv0alpha1.SecureValue
	cb  func(*secretv0alpha1.SecureValue, error)
}

func (simDatabaseCreateSecureValueMetadataQuery) Message() {}

type simDatabaseAppendResponse struct {
	cb  func(error)
	err error
}

func (simDatabaseAppendResponse) Message() {}

// Returns true when there are messages in flight.
func (network *SimNetwork) HasWork() bool {
	return len(network.messages) > 0
}

// Processes one of the messages in flight by delivering it to the target.
func (network *SimNetwork) Tick() {
	// TODO: inject errors: partitions, timeouts, asymmetry

	// Choose any in flight message
	i := network.rng.Intn(len(network.messages))
	message := network.messages[i]
	// Remove the message from in flight messages
	network.messages = append(network.messages[:i], network.messages[i+1:]...)

	fmt.Printf("\n\naaaaaaa Network: delivering message message %+v\n\n", message)

	// Deliver the message
	network.simDatabase.onQuery(message)
}

func (network *SimNetwork) Send(msg Message) {
	network.messages = append(network.messages, msg)
}

func (network *SimNetwork) Reply(toCallback func()) {
	network.messages = append(network.messages, msg)
}
