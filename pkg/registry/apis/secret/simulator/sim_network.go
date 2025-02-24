package simulator

import (
	"context"
	"fmt"
	"math/rand"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type SimNetworkConfig struct {
	errProbability float64 // [0,1]
	rng            *rand.Rand
}

// Simulation version of the network which requests go through.
type SimNetwork struct {
	config SimNetworkConfig

	// The set of messages in flgith
	messages    []Message
	simDatabase *SimDatabase
}

func NewSimNetwork(config SimNetworkConfig, simDatabase *SimDatabase) *SimNetwork {
	return &SimNetwork{config: config, simDatabase: simDatabase}
}

type Message interface {
	Message()
}

/*** Request ***/
type simDatabaseAppendQuery struct {
	ctx context.Context
	tx  contracts.TransactionManager
	foo any
	cb  func(error)
}

func (simDatabaseAppendQuery) Message() {}

type simDatabaseSecretMetadataHasPendingStatusQuery struct {
	ctx       context.Context
	tx        contracts.TransactionManager
	namespace xkube.Namespace
	name      string
	cb        func(bool, error)
}

func (simDatabaseSecretMetadataHasPendingStatusQuery) Message() {}

type simDatabaseCreateSecureValueMetadataQuery struct {
	ctx context.Context
	tx  contracts.TransactionManager
	sv  *secretv0alpha1.SecureValue
	cb  func(*secretv0alpha1.SecureValue, error)
}

func (simDatabaseCreateSecureValueMetadataQuery) Message() {}

/*** Response ***/
type simDatabaseAppendResponse struct {
	cb  func(error)
	err error
}

func (simDatabaseAppendResponse) Message() {}

type simDatabaseSecretMetadataHasPendingStatusResponse struct {
	cb        func(bool, error)
	isPending bool
	err       error
}

func (simDatabaseSecretMetadataHasPendingStatusResponse) Message() {}

type simDatabaseCreateSecureValueMetadataResponse struct {
	cb  func(*secretv0alpha1.SecureValue, error)
	sv  *secretv0alpha1.SecureValue
	err error
}

func (simDatabaseCreateSecureValueMetadataResponse) Message() {}

// Returns true when there are messages in flight.
func (network *SimNetwork) HasWork() bool {
	return len(network.messages) > 0
}

// Processes one of the messages in flight by delivering it to the target.
func (network *SimNetwork) Tick() {
	// TODO: inject errors: partitions, timeouts, asymmetry

	// Choose any in flight message
	i := network.config.rng.Intn(len(network.messages))
	message := network.messages[i]
	// Remove the message from in flight messages
	network.messages = append(network.messages[:i], network.messages[i+1:]...)

	fmt.Printf("\n\naaaaaaa Network: delivering message message %+v\n\n", message)

	// Are we going to have an error? Let's roll the dice
	if network.config.errProbability > network.config.rng.Float64() {
		return
	}

	// Deliver the message
	switch msg := message.(type) {
	case simDatabaseAppendResponse:
		msg.cb(msg.err)

	case simDatabaseSecretMetadataHasPendingStatusResponse:
		msg.cb(msg.isPending, msg.err)

	case simDatabaseCreateSecureValueMetadataResponse:
		msg.cb(msg.sv, msg.err)

	default:
		network.simDatabase.onQuery(message)
	}
}

func (network *SimNetwork) Send(msg Message) {
	network.messages = append(network.messages, msg)
}
