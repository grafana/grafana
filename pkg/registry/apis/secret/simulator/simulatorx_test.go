package simulator

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"testing"
	"time"

	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/coro"
	keepertypes "github.com/grafana/grafana/pkg/registry/apis/secret/secretkeeper/types"
	"github.com/grafana/grafana/pkg/registry/apis/secret/services"
	"github.com/grafana/grafana/pkg/registry/apis/secret/worker"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type Action string

// IMPORTANT: Add new actions to the slice in enabledActions.
const (
	ActionCreateSecret    Action = "CreateSecret"
	ActionResumeCoroutine Action = "ResumeCoroutine"
)

type Simulator struct {
	// A seeded prng.
	rng                *rand.Rand
	runtime            *coro.Runtime
	activityLog        *ActivityLog
	simNetwork         *SimNetwork
	simDatabase        *SimDatabase
	secureValueStorage *SimSecureValueStorage
	secureValueService *services.CreateSecureValue
}

func NewSimulator(rng *rand.Rand, runtime *coro.Runtime, activityLog *ActivityLog, simNetwork *SimNetwork, simDatabase *SimDatabase, secureValueStorage *SimSecureValueStorage, secureValueService *services.CreateSecureValue) *Simulator {
	return &Simulator{
		rng:                rng,
		runtime:            runtime,
		activityLog:        activityLog,
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
	for _, action := range []Action{ActionCreateSecret, ActionResumeCoroutine} {
		switch action {
		case ActionCreateSecret:
			// It always makes sense to try to create a secret, no matter the state of system.
			enabled = append(enabled, action)

		case ActionResumeCoroutine:
			if sim.runtime.HasCoroutinesReady() {
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
	sim.execute(action)
}

func (sim *Simulator) execute(action Action) {
	switch action {
	case ActionCreateSecret:
		sim.activityLog.Record("[SIM] CreateSecret")
		// Spawn a coroutine to make the request resumable
		coroutine := sim.runtime.Spawn(func() {
			// TODO: call secure_value_rest.Create
			object, err := sim.secureValueService.Handle(context.Background(), &secretv0alpha1.SecureValue{
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
			})
			// TODO: handle error
			fmt.Printf("\n\naaaaaaa secureValueService.Handle object %+v err %+v\n\n", object, err)
		})
		// Resume once so action can make progress at least once
		coroutine.Resume(nil)

	case ActionResumeCoroutine:
		sim.activityLog.Record("[SIM] ResumeCoroutine")
		// Choose a random coroutine
		i := sim.rng.Intn(len(sim.runtime.ReadySet))
		ready := sim.runtime.ReadySet[i]
		// Remove the coroutine from the set of coroutines waiting to be resumed
		sim.runtime.ReadySet = append(sim.runtime.ReadySet[:i], sim.runtime.ReadySet[i+1:]...)
		// Resume the coroutine
		ready.Coroutine.Resume(ready.Payload)

	default:
		panic(fmt.Sprintf("unhandled action: %+v", action))
	}
}

type SimulatorConfig struct {
	Seed  int64
	Steps int64
}

func int64FromEnv(key string) (bool, int64) {
	if v := os.Getenv("SEED"); v != "" {
		n, err := strconv.ParseInt(v, 10, 64)
		if err != nil {
			panic(fmt.Sprintf("%s must be an integer, got=%+v err=%+v", key, v, err))
		}

		return true, n
	}

	return false, 0
}

func getSimulatorConfigOrDefault() SimulatorConfig {
	var seed int64
	found, v := int64FromEnv("SEED")
	if found {
		seed = v
	} else {
		seed = rand.Int63()
	}

	var steps int64
	found, v = int64FromEnv("STEPS")
	if found {
		steps = v
	} else {
		steps = 10_000
	}

	return SimulatorConfig{
		Seed:  seed,
		Steps: steps,
	}
}

func TestSimulate(t *testing.T) {
	t.Parallel()

	simulatorConfig := getSimulatorConfigOrDefault()
	rng := rand.New(rand.NewSource(simulatorConfig.Seed))
	activityLog := NewActivityLog()

	defer func() {
		if err := recover(); err != nil || t.Failed() {
			fmt.Println(activityLog.String())
			fmt.Printf("SEED=%+v", simulatorConfig.Seed)
			if err != nil {
				panic(err)
			}
		}
	}()

	simDatabase := NewSimDatabase()

	simNetwork := NewSimNetwork(SimNetworkConfig{rng: rng}, activityLog, simDatabase)

	simTransactionManager := NewSimTransactionManager(simNetwork, simDatabase)

	simSecureValueStorage := NewSimSecureValueStorage(simNetwork, simDatabase)

	simOutboxQueue := NewSimOutboxQueue(simNetwork, simDatabase)

	keepers := map[keepertypes.KeeperType]keepertypes.Keeper{
		keepertypes.SQLKeeperType: fakes.,
	}

	worker := worker.NewWorker(worker.Config{
		// Generate a number between 1 and 100
		BatchSize: uint(1 + rng.Intn(100)),
		// Generate a number between 1 and 100
		ReceiveTimeout: time.Duration(1+rng.Intn(100)) * time.Millisecond,
	}, simTransactionManager, simOutboxQueue, simSecureValueStorage, keepers)

	secureValueService := services.NewCreateSecureValue(simTransactionManager, simSecureValueStorage, simOutboxQueue)

	runtime := coro.NewRuntime()

	simulator := NewSimulator(rng, runtime, activityLog, simNetwork, simDatabase, simSecureValueStorage, secureValueService)

	for range simulatorConfig.Steps {
		simulator.step()

		invOnlyOneOperationPerSecureValueInTheQueueAtATime(t, simDatabase)
		invSecretMetadataHasPendingStatusWhenTheresAnOperationInTheQueue(t, simDatabase)
	}
}

// TLA+ inv: OnlyOneOperationPerSecureValueInTheQueueAtATime
func invOnlyOneOperationPerSecureValueInTheQueueAtATime(t *testing.T, simDatabase *SimDatabase) {
	uniqueSecretName := make(map[string]struct{}, 0)
	for _, sv := range simDatabase.outboxQueue {
		secureValueName := sv.Name

		require.NotContains(t, uniqueSecretName, secureValueName, fmt.Sprintf("Current SecureValues: %v", uniqueSecretName))

		uniqueSecretName[secureValueName] = struct{}{}
	}
}

// TLA+ inv: SecretMetadataHasPendingStatusWhenTheresAnOperationInTheQueue
func invSecretMetadataHasPendingStatusWhenTheresAnOperationInTheQueue(t *testing.T, simDatabase *SimDatabase) {
	secureValuesInQueue := make(map[string]map[string]struct{}, 0)
	for _, sv := range simDatabase.outboxQueue {
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

// TODO: implement me
// EventuallyEveryMetadataStatusIsReady ==
//     \* For all secrets
//     \A secret \in Secrets:
//         \* Transform the queue.pending tuple into a set
//         LET PendingQueueSet == {queue.pending[i]: i \in DOMAIN queue.pending} IN
//             \* If the secret is in the pending queue
//             /\ secret \in PendingQueueSet
//             \* Leads to it eventually
//             ~>
//                 \* Being in the processed queue
//                 /\ secret \in queue.processed
//                 \* And removed from the pending queue
//                 /\ secret \notin PendingQueueSet
//                 \* And the secret being in the metadata table with status "Succeeded"
//                 /\ \E metadata \in db.secret_metadata:
//                     /\ metadata.name = secret
//                     /\ metadata.status = "Succeeded"
