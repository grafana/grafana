package simulator

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/coro"
	"github.com/grafana/grafana/pkg/registry/apis/secret/xkube"
)

type SendInput struct {
	// A description of the action
	Debug string
	// The function that will be called
	Execute func() any
}

type SimNetworkConfig struct {
	rng *rand.Rand
}

// Simulation version of the network which requests go through.
type SimNetwork struct {
	config        SimNetworkConfig
	activityLog   *ActivityLog
	simDatabase   *SimDatabase
	nextMessageID uint64
}

func NewSimNetwork(config SimNetworkConfig, activityLog *ActivityLog, simDatabase *SimDatabase) *SimNetwork {
	return &SimNetwork{config: config, activityLog: activityLog, simDatabase: simDatabase}
}

func (network *SimNetwork) getNextMessageID() uint64 {
	id := network.nextMessageID
	network.nextMessageID += 1
	return id
}

func (network *SimNetwork) Send(input SendInput) any {
	// Yield before executing the action to simulate a message in flight
	if v := coro.Yield(); v != nil {
		panic(fmt.Sprintf("network.Send resumed with non-nil value, it should always be nil: %+v", v))
	}

	// TODO: inject errors

	// Execute the action
	reply := input.Execute()

	// Log that the message was delivered to the destination
	network.activityLog.Record("[NETWORK] ->%s", input.Debug)

	// Yield before returning the reply to simulate a reply message in flight
	if v := coro.Yield(); v != nil {
		panic(fmt.Sprintf("network.Send resumed with non-nil value, it should always be nil: %+v", v))
	}

	// Log that the reply was delivered to the source
	network.activityLog.Record("[NETWORK] <-%s(%T%+v)", input.Debug, reply, reply)

	return reply
}

/*** Request ***/
type simDatabaseAppendQuery struct {
	transactionID TransactionID
	message       contracts.AppendOutboxMessage
}

type simDatabaseOutboxReceive struct {
	n uint
}

type simDatabaseSecretMetadataHasPendingStatusQuery struct {
	ctx       context.Context
	namespace xkube.Namespace
	name      string
}

type simDatabaseCreateSecureValueMetadataQuery struct {
	ctx           context.Context
	transactionID TransactionID
	sv            *secretv0alpha1.SecureValue
}

type simDatabaseBeginTxQuery struct {
	ctx  context.Context
	opts *sql.TxOptions
}

/*** Response ***/
type simDatabaseAppendResponse struct {
	err error
}

type simDatabaseOutboxReceiveResponse struct {
	messages []contracts.OutboxMessage
	err      error
}

type simDatabaseSecretMetadataHasPendingStatusResponse struct {
	isPending bool
	err       error
}

type simDatabaseCreateSecureValueMetadataResponse struct {
	sv  *secretv0alpha1.SecureValue
	err error
}

type simDatabaseBeginTxResponse struct {
	transactionID TransactionID
	err           error
}

type simDatabaseCommit struct {
	transactionID TransactionID
}

type simDatabaseCommitResponse struct {
	err error
}

type simDatabaseRollback struct {
	transactionID TransactionID
}

type simDatabaseRollbackResponse struct {
	err error
}
