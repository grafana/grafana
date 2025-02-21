package simulator

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"testing"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

type Action string

// IMPORTANT: Add new actions to the slice in enabledActions.
const (
	ActionCreateSecret Action = "CreateSecret"
	ActionNetworkTick  Action = "ActionNetworkTick"
)

type Simulator struct {
	// A seeded prng.
	rng                *rand.Rand
	simNetwork         *SimNetwork
	secureValueStorage *SimSecureValueStorage
	secureValueRest    *reststorage.SecureValueRest
}

func NewSimulator(rng *rand.Rand, simNetwork *SimNetwork, secureValueStorage *SimSecureValueStorage, secureValueRest *reststorage.SecureValueRest) *Simulator {
	return &Simulator{
		rng:                rng,
		simNetwork:         simNetwork,
		secureValueStorage: secureValueStorage,
		secureValueRest:    secureValueRest,
	}
}

// Returns the list of actions that make sense to possibly execute
// based on the global state of the system.
// Ex: it doesn't make sense to try to timeout a request if no requests are in flight
func (sim *Simulator) enabledActions() []Action {
	enabled := make([]Action, 0)

	// For each action, check if it would make sense to execute the action
	// given the state of system, if so, add it to `enabled`.
	for _, action := range []Action{ActionCreateSecret, ActionNetworkTick} {
		switch action {
		case ActionCreateSecret:
			// It always makes sense to try to create a secret, no matter the state of system.
			enabled = append(enabled, action)

		case ActionNetworkTick:
			if sim.simNetwork.HasWork() {
				enabled = append(enabled, action)
			}

		default:
			panic(fmt.Sprintf("unhandled action: %+v", action))
		}
	}

	return enabled
}

func (sim *Simulator) nextAction() Action {
	enabledActions := sim.enabledActions()
	i := sim.rng.Intn(len(enabledActions))
	return enabledActions[i]
}

func (sim *Simulator) step() {
	action := sim.nextAction()

	switch action {
	case ActionCreateSecret:
		sim.secureValueRest.Create2(context.Background(), &secretv0alpha1.SecureValue{
			Spec: secretv0alpha1.SecureValueSpec{
				Title: "foo",
				Value: secretv0alpha1.NewExposedSecureValue("value1"),
			},
		},
			// TODO: replace with real func
			func(ctx context.Context, obj runtime.Object) error {
				return nil
			},
			&metav1.CreateOptions{},
			func(o runtime.Object, err error) {
				fmt.Printf("\n\naaaaaaa o %+v err %+v\n\n", o, err)
			},
		)

	case ActionNetworkTick:
		sim.simNetwork.Tick()

	default:
		panic(fmt.Sprintf("unhandled action: %+v", action))
	}
}

func getSeedFromEnvOrRandom() int64 {
	if seed := os.Getenv("SEED"); seed != "" {
		n, err := strconv.ParseInt(seed, 10, 64)
		if err != nil {
			panic(fmt.Sprintf("SEED must be an integer, got=%+v err=%+v", seed, err))
		}

		return n
	}

	return rand.Int63()
}

func TestSimulate(t *testing.T) {
	t.Parallel()

	seed := getSeedFromEnvOrRandom()
	rng := rand.New(rand.NewSource(seed))

	t.Cleanup(func() {
		if t.Failed() {
			fmt.Printf("SEED=%+v\n", seed)
		}
	})

	simDatabase := NewSimDatabase()

	simNetwork := NewSimNetwork(rng, simDatabase)

	simSecureValueStorage := NewSimSecureValueStorage(simNetwork)

	simOutboxQueue := NewSimOutboxQueue(simNetwork)

	secureValueRest := reststorage.NewSecureValueRest(simSecureValueStorage, simOutboxQueue, utils.ResourceInfo{})

	simulator := NewSimulator(rng, simNetwork, simSecureValueStorage, secureValueRest)

	for range 10 {
		simulator.step()
	}
}
