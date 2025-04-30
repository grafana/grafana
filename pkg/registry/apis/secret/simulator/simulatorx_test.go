package simulator

import (
	"context"
	"fmt"
	"math/rand"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/authlib/types"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	secretv0alpha1 "github.com/grafana/grafana/pkg/apis/secret/v0alpha1"
	"github.com/grafana/grafana/pkg/registry/apis/secret/contracts"
	"github.com/grafana/grafana/pkg/registry/apis/secret/coro"
	"github.com/grafana/grafana/pkg/registry/apis/secret/reststorage"
	"github.com/grafana/grafana/pkg/registry/apis/secret/service"
	"github.com/grafana/grafana/pkg/services/accesscontrol"
	"github.com/grafana/grafana/pkg/services/accesscontrol/actest"

	"github.com/grafana/grafana/pkg/registry/apis/secret/worker"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/endpoints/request"
)

type Action string

// IMPORTANT: Add new actions to the slice in enabledActions.
const (
	ActionCreateSecret      Action = "CreateSecret"
	ActionDeleteSecret      Action = "DeleteSecret"
	ActionResumeCoroutine   Action = "ResumeCoroutine"
	ActionStartOutboxWorker Action = "StartOutboxWorker"
)

type Simulator struct {
	t     *testing.T
	model *Model
	// A seeded prng.
	rng                   *rand.Rand
	config                SimulatorConfig
	runtime               *coro.Runtime
	activityLog           *ActivityLog
	simNetwork            *SimNetwork
	simDatabaseClient     contracts.Database
	simDatabaseServer     *SimDatabaseServer
	simOutboxQueue        contracts.OutboxQueue
	simSecureValueStorage contracts.SecureValueMetadataStorage
	keeperMetadataStorage contracts.KeeperMetadataStorage
	keeperService         contracts.KeeperService
	secureValueRest       *reststorage.SecureValueRest
	metrics               SimulationMetrics
}

type SimulationMetrics struct {
	// The number of steps taken. Invariant NumSteps <= SimulatorConfig.Steps
	NumSteps uint
	// The number of workers running at the moment.
	// The max number of workers is defined in SimulatorConfig.
	NumWorkersStarted uint
	// The number of create secret requets sent
	NumCreateSecrets uint
}

func NewSimulator(
	t *testing.T,
	model *Model,
	rng *rand.Rand,
	config SimulatorConfig,
	runtime *coro.Runtime,
	activityLog *ActivityLog,
	simNetwork *SimNetwork,
	simOutboxQueue contracts.OutboxQueue,
	simDatabaseClient contracts.Database,
	simDatabaseServer *SimDatabaseServer,
	simSecureValueStorage contracts.SecureValueMetadataStorage,
	keeperMetadataStorage contracts.KeeperMetadataStorage,
	keeperService contracts.KeeperService,
	secureValueRest *reststorage.SecureValueRest,
) *Simulator {
	if config.Seed == 0 {
		panic("config.Seed is required")
	}
	if config.Steps == 0 {
		panic("config.Steps is required")
	}
	if config.NumWorkers == 0 {
		panic("config.NumWorkers is required")
	}
	if config.MaxCreateSecrets == 0 {
		panic("config.MaxCreateSecrets is required")
	}
	if config.CreateDuplicateSecretProbability == 0.0 {
		panic("config.CreateDuplicateSecretProbability is required")
	}

	return &Simulator{
		t:                     t,
		model:                 model,
		rng:                   rng,
		config:                config,
		runtime:               runtime,
		activityLog:           activityLog,
		simNetwork:            simNetwork,
		simOutboxQueue:        simOutboxQueue,
		simDatabaseClient:     simDatabaseClient,
		simDatabaseServer:     simDatabaseServer,
		simSecureValueStorage: simSecureValueStorage,
		keeperMetadataStorage: keeperMetadataStorage,
		keeperService:         keeperService,
		secureValueRest:       secureValueRest,
		metrics:               SimulationMetrics{},
	}
}

// Returns the list of actions that make sense to possibly execute
// based on the global state of the system.
// Ex: it doesn't make sense to try to timeout a request if no requests are in flight
func (sim *Simulator) enabledActions() []Action {
	enabled := make([]Action, 0)

	// For each action, check if it would make sense to execute the action
	// given the state of system, if so, add it to `enabled`.
	for _, action := range []Action{ActionCreateSecret, ActionDeleteSecret, ActionResumeCoroutine, ActionStartOutboxWorker} {
		switch action {
		case ActionCreateSecret:
			if sim.metrics.NumCreateSecrets < sim.config.MaxCreateSecrets {
				enabled = append(enabled, action)
			}

		case ActionDeleteSecret:
			// Always enabled to try deleting secrets that doesn't exist
			enabled = append(enabled, action)

		case ActionResumeCoroutine:
			if sim.runtime.HasCoroutinesReady() {
				enabled = append(enabled, action)
			}

		case ActionStartOutboxWorker:
			if sim.metrics.NumWorkersStarted < sim.config.NumWorkers {
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
	sim.metrics.NumSteps++
	action := sim.nextAction()
	sim.execute(action)
}

func (sim *Simulator) genCreateSecureValueInput() *secretv0alpha1.SecureValue {
	// If a secret exists, maybe try to recreate it
	// if len(sim.simDatabaseServer.secretMetadata) > 0 && sim.rng.Float32() >= sim.config.CreateDuplicateSecretProbability {
	// 	for _, secureValues := range sim.simDatabaseServer.secretMetadata {
	// 		for _, secureValue := range secureValues {
	// 			return &secretv0alpha1.SecureValue{
	// 				ObjectMeta: metav1.ObjectMeta{
	// 					Name:      secureValue.Name,
	// 					Namespace: secureValue.Namespace,
	// 				},
	// 				Spec: secretv0alpha1.SecureValueSpec{
	// 					Title: secureValue.Spec.Title,
	// 					Value: secretv0alpha1.NewExposedSecureValue("value1"),
	// 				},
	// 				Status: secretv0alpha1.SecureValueStatus{
	// 					Phase: secretv0alpha1.SecureValuePhasePending,
	// 				},
	// 			}
	// 		}
	// 	}
	// }
	return &secretv0alpha1.SecureValue{
		ObjectMeta: metav1.ObjectMeta{
			Name:      fmt.Sprintf("sv-%d", sim.metrics.NumSteps),
			Namespace: fmt.Sprintf("stack-%d", sim.metrics.NumSteps),
		},
		Spec: secretv0alpha1.SecureValueSpec{
			Value: secretv0alpha1.NewExposedSecureValue(fmt.Sprintf("value-%d", sim.metrics.NumSteps)),
		},
		Status: secretv0alpha1.SecureValueStatus{
			Phase: secretv0alpha1.SecureValuePhasePending,
		},
	}
}

func (sim *Simulator) genDeleteSecureValueInput() (string, string) {
	for _, secureValues := range sim.simDatabaseServer.secretMetadata {
		for _, secureValue := range secureValues {
			return secureValue.Namespace, secureValue.Name
		}
	}
	return "doesnt_exist_ns", "doesnt_exist_v"
}

func (sim *Simulator) execute(action Action) {
	switch action {
	case ActionCreateSecret:
		sim.metrics.NumCreateSecrets++
		sim.activityLog.Record("[SIM] %s", action)

		// Spawn a coroutine to make the request resumable
		coroutine := sim.runtime.Spawn(func() {
			ctx := createAuthContext(context.Background(), "default", []string{"secret.grafana.app/securevalues/group1:decrypt"}, types.TypeUser)
			sv := sim.genCreateSecureValueInput()
			validateObjectFunc := func(context.Context, runtime.Object) error {
				return nil
			}
			createOptions := &metav1.CreateOptions{}
			_, err := sim.secureValueRest.Create(ctx, sv, validateObjectFunc, createOptions)
			_, modelErr := sim.model.Create(ctx, sv, validateObjectFunc, createOptions)
			require.ErrorIs(sim.t, err, modelErr)
		})
		// Resume once so action can make progress at least once
		coroutine.Resume(nil)

	case ActionDeleteSecret:
		sim.metrics.NumCreateSecrets++
		sim.activityLog.Record("[SIM] %s", action)

		// Spawn a coroutine to make the request resumable
		coroutine := sim.runtime.Spawn(func() {
			ctx := context.Background()
			namespace, name := sim.genDeleteSecureValueInput()
			deleteValidationfunc := func(context.Context, runtime.Object) error {
				return nil
			}
			sim.activityLog.Record("deleting namespace=%s name=%s", namespace, name)

			deleteOptions := &metav1.DeleteOptions{}
			_, deleted, err := sim.secureValueRest.Delete(request.WithNamespace(ctx, namespace), name, deleteValidationfunc, deleteOptions)
			_ = deleted
			_ = err
			sim.activityLog.Record("deleted namespace=%s name=%s", namespace, name)
			// modelDeleted, modelErr := sim.model.Delete(namespace, name)
			// require.ErrorIs(sim.t, err, modelErr)
			// require.Equal(sim.t, modelDeleted, deleted)
		})
		// Resume once so action can make progress at least once
		coroutine.Resume(nil)

	case ActionResumeCoroutine:
		// Choose a random coroutine
		i := sim.rng.Intn(len(sim.runtime.ReadySet))
		ready := sim.runtime.ReadySet[i]
		// Remove the coroutine from the set of coroutines waiting to be resumed
		sim.runtime.ReadySet = append(sim.runtime.ReadySet[:i], sim.runtime.ReadySet[i+1:]...)
		// Resume the coroutine
		ready.Coroutine.Resume(ready.Payload)

	case ActionStartOutboxWorker:
		sim.metrics.NumWorkersStarted++

		coroutine := sim.runtime.Spawn(func() {
			worker := worker.NewWorker(worker.Config{
				// Generate a number between 1 and 100
				BatchSize: uint(1 + sim.rng.Intn(100)),
				// Generate a number between 1 and 100
				ReceiveTimeout: time.Duration(1+sim.rng.Intn(100)) * time.Millisecond,
			}, sim.simDatabaseClient, sim.simOutboxQueue, sim.simSecureValueStorage, sim.keeperMetadataStorage, sim.keeperService)

			if err := worker.ControlLoop(context.Background()); err != nil {
				panic(fmt.Sprintf("worker panicked: %+v", err))
			}
		})
		coroutine.Resume(nil)

		sim.activityLog.Record("[SIM] %s numWorkers=%d", action, sim.metrics.NumWorkersStarted)

	default:
		panic(fmt.Sprintf("unhandled action: %+v", action))
	}
}

type SimulatorConfig struct {
	Seed  int64
	Steps int64
	// The number of outbox queue workers to start
	NumWorkers uint
	// The maximum number of create secrets requests to send
	MaxCreateSecrets uint
	// The probability of trying to create a secret that already exists
	CreateDuplicateSecretProbability float32
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
		// TODO: random number of workers
		NumWorkers:                       3,
		MaxCreateSecrets:                 5,
		CreateDuplicateSecretProbability: 0.5,
	}
}

func TestSimulate(t *testing.T) {
	t.Parallel()

	simulatorConfig := getSimulatorConfigOrDefault()
	simulatorConfig.Seed = 8890920885552465367
	rng := rand.New(rand.NewSource(simulatorConfig.Seed))
	activityLog := NewActivityLog()

	fmt.Printf("\n\naaaaaaa SEED %+v\n\n", simulatorConfig.Seed)

	defer func() {
		if err := recover(); err != nil || t.Failed() {
			// fmt.Println(activityLog.String())
			fmt.Printf("SEED=%+v", simulatorConfig.Seed)
			if err != nil {
				panic(err)
			}
			return
		}

		fmt.Printf("SEED=%+v Success!\n", simulatorConfig.Seed)
	}()

	simDatabaseServer := NewSimDatabaseServer(activityLog)

	simNetwork := NewSimNetwork(SimNetworkConfig{rng: rng}, activityLog)

	simDatabaseClient := NewSimDatabaseClient(simNetwork, simDatabaseServer)

	simSecureValueMetadataStorage := NewSimSecureMetadataValueStorage(simNetwork, simDatabaseServer)

	simOutboxQueue := NewSimOutboxQueue(simNetwork, simDatabaseServer)

	simKeeperMetadataStorage := NewSimKeeperMetadataStorage()

	keeperService := NewSimKeeperService()

	accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
	accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

	secretService := service.ProvideSecretService(accessClient, simDatabaseClient, simSecureValueMetadataStorage, simOutboxQueue)

	secureValueRest := reststorage.NewSecureValueRest(secretService, utils.ResourceInfo{})

	runtime := coro.NewRuntime()

	simulator := NewSimulator(
		t,
		NewModel(),
		rng,
		simulatorConfig,
		runtime,
		activityLog,
		simNetwork,
		simOutboxQueue,
		simDatabaseClient,
		simDatabaseServer,
		simSecureValueMetadataStorage,
		simKeeperMetadataStorage,
		keeperService,
		secureValueRest,
	)

	for range simulatorConfig.Steps {
		simulator.step()

		invOnlyOneOperationPerSecureValueInTheQueueAtATime(t, simDatabaseServer)
		invSecretMetadataHasPendingStatusWhenTheresAnOperationInTheQueue(t, simDatabaseServer)
	}
}

// func AAASimulateWithRealImplementation(t *testing.T) {
// 	t.Parallel()

// 	simulatorConfig := getSimulatorConfigOrDefault()
// 	rng := rand.New(rand.NewSource(simulatorConfig.Seed))
// 	activityLog := NewActivityLog()

// 	defer func() {
// 		if err := recover(); err != nil || t.Failed() {
// 			fmt.Println(activityLog.String())
// 			fmt.Printf("SEED=%+v", simulatorConfig.Seed)
// 			if err != nil {
// 				panic(err)
// 			}
// 		}
// 	}()

// 	testDB := sqlstore.NewTestStore(t)
// 	require.NoError(t, migrator.MigrateSecretSQL(testDB.GetEngine(), nil))

// 	outbox := metadata.ProvideOutboxQueue(testDB)
// 	features := featuremgmt.WithFeatures(featuremgmt.FlagGrafanaAPIServerWithExperimentalAPIs, featuremgmt.FlagSecretsManagementAppPlatform)

// 	dataKeyStore, err := encryptionstorage.ProvideDataKeyStorage(testDB, features)
// 	require.NoError(t, err)

// 	encValueStore, err := encryptionstorage.ProvideEncryptedValueStorage(testDB, features)
// 	require.NoError(t, err)

// 	// Initialize the encryption manager
// 	encMgr, err := encryptionmanager.ProvideEncryptionManager(
// 		tracing.InitializeTracerForTest(),
// 		dataKeyStore,
// 		&setting.Cfg{
// 			SecretsManagement: setting.SecretsManagerSettings{
// 				SecretKey:          "sdDkslslld",
// 				EncryptionProvider: "secretKey.v1",
// 				Encryption: setting.EncryptionSettings{
// 					DataKeysCacheTTL:        5 * time.Minute,
// 					DataKeysCleanupInterval: 1 * time.Nanosecond,
// 					Algorithm:               "aes-cfb",
// 				},
// 			},
// 		},
// 		&usagestats.UsageStatsMock{},
// 		encryption.ProviderMap{},
// 	)
// 	require.NoError(t, err)

// 	// Initialize the keeper service
// 	keeperService, err := secretkeeper.ProvideService(tracing.InitializeTracerForTest(), encValueStore, encMgr)
// 	require.NoError(t, err)

// 	// Initialize access client + access control
// 	accessControl := &actest.FakeAccessControl{ExpectedEvaluate: true}
// 	accessClient := accesscontrol.NewLegacyAccessClient(accessControl)

// 	// Initialize the keeper storage and add a test keeper
// 	keeperMetadataStorage, err := metadata.ProvideKeeperMetadataStorage(testDB, features, accessClient)
// 	require.NoError(t, err)

// 	// Initialize the secure value storage
// 	secureValueMetadataStorage, err := metadata.ProvideSecureValueMetadataStorage(testDB, features, accessClient, keeperMetadataStorage, keeperService)
// 	require.NoError(t, err)

// 	simNetwork := NewSimNetwork(SimNetworkConfig{rng: rng}, activityLog)

// 	// simDatabaseClient := NewSimDatabaseClient(simNetwork, simDatabaseServer)
// 	simDatabaseClient := NewSimDatabase2(simNetwork, testDB)

// 	simKeeperMetadataStorage := NewSimKeeperMetadataStorage()

// 	secureValueRest := reststorage.NewSecureValueRest(secureValueMetadataStorage, simDatabaseClient, outbox, utils.ResourceInfo{})

// 	runtime := coro.NewRuntime()

// 	simulator := NewSimulator(
// 		t,
// 		NewModel(),
// 		rng,
// 		simulatorConfig,
// 		runtime,
// 		activityLog,
// 		simNetwork,
// 		outbox,
// 		keepers,
// 		simDatabaseClient,
// 		nil,
// 		secureValueMetadataStorage,
// 		simKeeperMetadataStorage,
// 		secureValueRest,
// 	)

// 	for range simulatorConfig.Steps {
// 		simulator.step()

// 		// invOnlyOneOperationPerSecureValueInTheQueueAtATime(t, simDatabaseServer)
// 		// invSecretMetadataHasPendingStatusWhenTheresAnOperationInTheQueue(t, simDatabaseServer)
// 	}
// }

// TLA+ inv: OnlyOneOperationPerSecureValueInTheQueueAtATime
func invOnlyOneOperationPerSecureValueInTheQueueAtATime(t *testing.T, simDatabase *SimDatabaseServer) {
	// A set of secure value names
	seen := make(map[string]struct{}, 0)

	for _, sv := range simDatabase.outboxQueue {
		secureValueName := sv.Name

		require.NotContains(t, seen, secureValueName, fmt.Sprintf("Current SecureValues: %v outbox=%+v", seen, simDatabase.outboxQueue))

		// Add the secure value name to the set
		seen[secureValueName] = struct{}{}
	}
}

// TLA+ inv: SecretMetadataHasPendingStatusWhenTheresAnOperationInTheQueue
func invSecretMetadataHasPendingStatusWhenTheresAnOperationInTheQueue(t *testing.T, simDatabase *SimDatabaseServer) {
	secureValuesInQueue := make(map[string]map[string]struct{}, 0)
	for _, sv := range simDatabase.outboxQueue {
		if _, ok := secureValuesInQueue[sv.Namespace]; !ok {
			secureValuesInQueue[sv.Namespace] = make(map[string]struct{})
		}

		secureValuesInQueue[sv.Namespace][sv.Name] = struct{}{}
	}

	for namespace, secureValues := range simDatabase.secretMetadata {
		for _, secureValue := range secureValues {
			require.NotEmpty(t, secureValue.Status.Phase)

			_, exists := secureValuesInQueue[namespace][secureValue.Name]
			statusPending := secureValue.Status.Phase == secretv0alpha1.SecureValuePhasePending

			require.True(t, (statusPending && exists || (!statusPending && !exists)), fmt.Sprintf("when there's a message in the queue for a secret, the secret should have Pending status: statusPending=%v exists=%v currentStatus=%+v metadata_db=%v", statusPending, exists, secureValue.Status.Phase, simDatabase.secretMetadata))
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

func createAuthContext(ctx context.Context, namespace string, permissions []string, identityType types.IdentityType) context.Context {
	requester := &identity.StaticRequester{
		Type:      identityType,
		Namespace: namespace,
		AccessTokenClaims: &authn.Claims[authn.AccessTokenClaims]{
			Rest: authn.AccessTokenClaims{
				Permissions: permissions,
			},
		},
	}

	if identityType == types.TypeUser {
		requester.UserID = 1
	}

	return types.WithAuthInfo(ctx, requester)
}
