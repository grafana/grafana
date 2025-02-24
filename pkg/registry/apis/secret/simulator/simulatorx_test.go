package simulator

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"testing"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/services"
	"github.com/stretchr/testify/require"
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
	simDatabase        *SimDatabase
	secureValueStorage *SimSecureValueStorage
	secureValueService *services.CreateSecureValue
}

func NewSimulator(rng *rand.Rand, simNetwork *SimNetwork, simDatabase *SimDatabase, secureValueStorage *SimSecureValueStorage, secureValueService *services.CreateSecureValue) *Simulator {
	return &Simulator{
		rng:                rng,
		simNetwork:         simNetwork,
		simDatabase:        simDatabase,
		secureValueStorage: secureValueStorage,
		secureValueService: secureValueService,
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
		sim.secureValueService.Handle(context.Background(), &secretv0alpha1.SecureValue{
			ObjectMeta: metav1.ObjectMeta{
				Name: "sv-1",
			},
			Spec: secretv0alpha1.SecureValueSpec{
				Title: "foo",
				Value: secretv0alpha1.NewExposedSecureValue("value1"),
			},
			Status: secretv0alpha1.SecureValueStatus{
				Phase: secretv0alpha1.SecureValuePhasePending,
			},
		},
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

	seed := getSeedFromEnvOrRandom() //int64(490660684584332)
	rng := rand.New(rand.NewSource(seed))

	t.Cleanup(func() {
		if t.Failed() {
			fmt.Printf("SEED=%+v\n", seed)
		}
	})

	simNetworkConfig := SimNetworkConfig{errProbability: 0.2, rng: rng}

	simDatabase := NewSimDatabase(nil)

	simNetwork := NewSimNetwork(simNetworkConfig, simDatabase)

	simDatabase.simNetwork = simNetwork

	simTransactionManager := NewSimTransactionManager(simNetwork)

	simSecureValueStorage := NewSimSecureValueStorage(simNetwork)

	simOutboxQueue := NewSimOutboxQueue(simNetwork)

	secureValueService := services.NewCreateSecureValue(simTransactionManager, simSecureValueStorage, simOutboxQueue)

	simulator := NewSimulator(rng, simNetwork, simDatabase, simSecureValueStorage, secureValueService)

	for range 100 {
		simulator.step()

		// Invariant
		/*
			OnlyOneOperationPerSecureValueInTheQueueAtATime ==
				\A secret \in Secrets:
					LET PendingQueueSet == {queue.pending[i]: i \in DOMAIN queue.pending}
						SecretInQueue   == {i \in DOMAIN queue.pending: queue.pending[i] = secret} IN
						\* There is either no secret in the pending queue, or at most one.
						Cardinality(SecretInQueue) <= 1
		*/
		uniqueSecretName := make(map[string]struct{}, 0)
		for _, sv := range simDatabase.outboxQueue {
			secureValueName := sv.(*secretv0alpha1.SecureValue).Name

			require.NotContains(t, uniqueSecretName, secureValueName, fmt.Sprintf("Current SecureValues: %v", uniqueSecretName))

			uniqueSecretName[secureValueName] = struct{}{}
		}

		/*
			SecretMetadataHasPendingStatusWhenTheresAnOperationInTheQueue ==
				\* For all secrets
				\A s \in Secrets:
				LET secret_in_pending_queue ==
					\E i \in DOMAIN queue.pending:
						queue.pending[i] = s
				IN
				\* the secret is either in the outbox queue
				\/ /\ secret_in_pending_queue
					\* and the secret metadata status is Pending
					/\ SecretMetadataHasPendingStatus(s)
				\* or the secret is not in the queue
				\/ /\ ~secret_in_pending_queue
					\* and the secret metadata status is not Pending
					/\ ~SecretMetadataHasPendingStatus(s)
		*/
		secureValuesInQueue := make(map[string]map[string]struct{}, 0)
		for _, rawSV := range simDatabase.outboxQueue {
			sv := rawSV.(*secretv0alpha1.SecureValue)

			if _, ok := secureValuesInQueue[sv.Namespace]; !ok {
				secureValuesInQueue[sv.Namespace] = make(map[string]struct{})
			}

			secureValuesInQueue[sv.Namespace][sv.Name] = struct{}{}
		}

		for namespace, secureValues := range simDatabase.secretMetadata {
			for _, secureValue := range secureValues {
				_, exists := secureValuesInQueue[namespace][secureValue.Name]
				statusPending := secureValue.Status.Phase == secretv0alpha1.SecureValuePhasePending

				require.True(t, (statusPending && exists || (!statusPending && !exists)), fmt.Sprintf("statusPending=%v exists=%v metadata_db=%v", statusPending, exists, simDatabase.secretMetadata))
			}
		}
	}
}
