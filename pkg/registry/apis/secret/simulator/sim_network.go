package simulator

import (
	"context"
	"fmt"
	"math/rand"

	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/coro"
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
	config      SimNetworkConfig
	activityLog *ActivityLog
}

func NewSimNetwork(config SimNetworkConfig, activityLog *ActivityLog) *SimNetwork {
	return &SimNetwork{config: config, activityLog: activityLog}
}

func (network *SimNetwork) Send(ctx context.Context, input SendInput) any {
	// Yield before executing the action to simulate a message in flight
	if v := coro.Yield(); v != nil {
		panic(fmt.Sprintf("network.Send resumed with non-nil value, it should always be nil: %+v", v))
	}

	// TODO: inject errors

	// Execute the action
	reply := input.Execute()

	// Log that the message was delivered to the destination
	network.activityLog.Record("(%+v) [NETWORK] ->%s", contracts.GetRequestId(ctx), input.Debug)

	// Yield before returning the reply to simulate a reply message in flight
	if v := coro.Yield(); v != nil {
		panic(fmt.Sprintf("network.Send resumed with non-nil value, it should always be nil: %+v", v))
	}

	// Log that the reply was delivered to the source
	network.activityLog.Record("(%+v) [NETWORK] <-%s (%T%+v)", contracts.GetRequestId(ctx), input.Debug, reply, reply)

	return reply
}

func toError(v any) error {
	if v != nil {
		return v.(error)
	}

	return nil
}
