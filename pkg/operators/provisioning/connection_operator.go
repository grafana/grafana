package provisioning

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/prometheus/client_golang/prometheus"
	"k8s.io/client-go/tools/cache"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection/github"
	appcontroller "github.com/grafana/grafana/apps/provisioning/pkg/controller"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	"github.com/grafana/grafana/pkg/infra/tracing"
	"github.com/grafana/grafana/pkg/registry/apis/provisioning/controller"
	secretdecrypt "github.com/grafana/grafana/pkg/registry/apis/secret/decrypt"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/setting"
)

// RunConnectionController starts the connection controller operator.
func RunConnectionController(deps server.OperatorDependencies) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-connection-controller")
	logger.Info("Starting provisioning connection controller")

	controllerCfg, err := getConnectionControllerConfig(deps.Config, deps.Registerer)
	if err != nil {
		return fmt.Errorf("failed to setup operator: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("Received shutdown signal, stopping controllers")
		cancel()
	}()

	informerFactory := informer.NewSharedInformerFactoryWithOptions(
		controllerCfg.provisioningControllerConfig.provisioningClient,
		controllerCfg.provisioningControllerConfig.resyncInterval,
	)

	statusPatcher := appcontroller.NewConnectionStatusPatcher(controllerCfg.provisioningControllerConfig.provisioningClient.ProvisioningV0alpha1())
	connInformer := informerFactory.Provisioning().V0alpha1().Connections()

	// Setup connection factory and tester
	connectionFactory, err := setupConnectionFactory(deps.Config, &controllerCfg.provisioningControllerConfig)
	if err != nil {
		return fmt.Errorf("failed to setup connection factory: %w", err)
	}
	tester := connection.NewSimpleConnectionTester(connectionFactory)

	connController, err := controller.NewConnectionController(
		controllerCfg.provisioningControllerConfig.provisioningClient.ProvisioningV0alpha1(),
		connInformer,
		statusPatcher,
		tester,
	)
	if err != nil {
		return fmt.Errorf("failed to create connection controller: %w", err)
	}

	informerFactory.Start(ctx.Done())
	if !cache.WaitForCacheSync(ctx.Done(), connInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync informer cache")
	}

	connController.Run(ctx, controllerCfg.workerCount)
	return nil
}

type connectionControllerConfig struct {
	provisioningControllerConfig
	workerCount int
}

func getConnectionControllerConfig(cfg *setting.Cfg, registry prometheus.Registerer) (*connectionControllerConfig, error) {
	controllerCfg, err := setupFromConfig(cfg, registry)
	if err != nil {
		return nil, err
	}

	return &connectionControllerConfig{
		provisioningControllerConfig: *controllerCfg,
		workerCount:                  cfg.SectionWithEnvOverrides("operator").Key("worker_count").MustInt(1),
	}, nil
}

func setupConnectionFactory(cfg *setting.Cfg, controllerCfg *provisioningControllerConfig) (connection.Factory, error) {
	// Setup decrypt service for connections
	secretsSec := cfg.SectionWithEnvOverrides("secrets_manager")
	if secretsSec == nil {
		return nil, fmt.Errorf("no [secrets_manager] section found in config")
	}

	address := secretsSec.Key("grpc_server_address").String()
	if address == "" {
		return nil, fmt.Errorf("grpc_server_address is required in [secrets_manager] section")
	}

	secretsTls := secretdecrypt.TLSConfig{
		UseTLS:             secretsSec.Key("grpc_server_use_tls").MustBool(true),
		CAFile:             secretsSec.Key("grpc_server_tls_ca_file").String(),
		ServerName:         secretsSec.Key("grpc_server_tls_server_name").String(),
		InsecureSkipVerify: secretsSec.Key("grpc_server_tls_skip_verify").MustBool(false),
	}

	decryptSvc, err := secretdecrypt.NewGRPCDecryptClientWithTLS(
		controllerCfg.tokenExchangeClient,
		tracing.NewNoopTracerService(),
		address,
		secretsTls,
		secretsSec.Key("grpc_client_load_balancing").MustBool(false),
	)
	if err != nil {
		return nil, fmt.Errorf("create decrypt service: %w", err)
	}

	// Create connection decrypter
	decrypter := connection.ProvideDecrypter(decryptSvc)

	// For now, only support GitHub connections
	// TODO: Add support for other connection types (GitLab, Bitbucket) when needed
	extras := []connection.Extra{
		github.Extra(decrypter, github.ProvideFactory()),
	}

	enabledTypes := map[provisioning.ConnectionType]struct{}{
		provisioning.GithubConnectionType: {},
	}

	connectionFactory, err := connection.ProvideFactory(enabledTypes, extras)
	if err != nil {
		return nil, fmt.Errorf("create connection factory: %w", err)
	}

	return connectionFactory, nil
}
