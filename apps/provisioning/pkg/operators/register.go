package operators

import (
	"context"
	"crypto/x509"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/urfave/cli/v2"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/transport"

	"github.com/grafana/grafana/pkg/cmd/grafana-server/commands"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"

	authrt "github.com/grafana/grafana/apps/provisioning/pkg/auth"
	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

func init() {
	commands.RegisterOperator(commands.Operator{
		Name:        "provisioning-jobs",
		Description: "Watch provisioning jobs and manage job history cleanup",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:  "token",
				Usage: "Token to use for authentication",
			},
			&cli.StringFlag{
				Name:  "token-exchange-url",
				Usage: "Token exchange URL",
			},
			&cli.StringFlag{
				Name:  "provisioning-server-url",
				Usage: "Provisioning server URL",
			},
			&cli.BoolFlag{
				Name:  "tls-insecure",
				Usage: "Skip TLS certificate verification",
				Value: true,
			},
			&cli.StringFlag{
				Name:  "tls-cert-file",
				Usage: "Path to TLS certificate file",
			},
			&cli.StringFlag{
				Name:  "tls-key-file",
				Usage: "Path to TLS private key file",
			},
			&cli.StringFlag{
				Name:  "tls-ca-file",
				Usage: "Path to TLS CA certificate file",
			},
			&cli.DurationFlag{
				Name:  "history-expiration",
				Usage: "Duration after which HistoricJobs are deleted; 0 disables cleanup. When the Provisioning API is configured to use Loki for job history, leave this at 0.",
				Value: 0,
			},
		},
		RunFunc: runJobController,
	})
}

func runJobController(opts standalone.BuildInfo, c *cli.Context) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "provisioning-job-controller")
	logger.Info("Starting provisioning job controller")

	token := c.String("token")
	tokenExchangeURL := c.String("token-exchange-url")
	provisioningServerURL := c.String("provisioning-server-url")
	tlsInsecure := c.Bool("tls-insecure")
	tlsCertFile := c.String("tls-cert-file")
	tlsKeyFile := c.String("tls-key-file")
	tlsCAFile := c.String("tls-ca-file")

	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: tokenExchangeURL,
		Token:            token,
	})
	if err != nil {
		return fmt.Errorf("failed to create token exchange client: %w", err)
	}

	tlsConfig, err := buildTLSConfig(tlsInsecure, tlsCertFile, tlsKeyFile, tlsCAFile)
	if err != nil {
		return fmt.Errorf("failed to build TLS configuration: %w", err)
	}

	config := &rest.Config{
		APIPath: "/apis",
		Host:    provisioningServerURL,
		WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
			return authrt.NewRoundTripper(tokenExchangeClient, rt)
		}),
		TLSClientConfig: tlsConfig,
	}

	provisioningClient, err := client.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
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

	// Jobs informer and controller (resync ~60s like in register.go)
	jobInformerFactory := informer.NewSharedInformerFactoryWithOptions(
		provisioningClient,
		60*time.Second,
	)
	jobInformer := jobInformerFactory.Provisioning().V0alpha1().Jobs()
	jobController, err := controller.NewJobController(jobInformer)
	if err != nil {
		return fmt.Errorf("failed to create job controller: %w", err)
	}

	logger.Info("jobs controller started")
	notifications := jobController.InsertNotifications()
	go func() {
		for {
			select {
			case <-ctx.Done():
				return
			case <-notifications:
				logger.Info("job create notification received")
			}
		}
	}()

	// Optionally enable history cleanup if a positive expiration is provided
	historyExpiration := c.Duration("history-expiration")
	var startHistoryInformers func()
	if historyExpiration > 0 {
		// History jobs informer and controller (separate factory with resync == expiration)
		historyInformerFactory := informer.NewSharedInformerFactoryWithOptions(
			provisioningClient,
			historyExpiration,
		)
		historyJobInformer := historyInformerFactory.Provisioning().V0alpha1().HistoricJobs()
		_, err = controller.NewHistoryJobController(
			provisioningClient.ProvisioningV0alpha1(),
			historyJobInformer,
			historyExpiration,
		)
		if err != nil {
			return fmt.Errorf("failed to create history job controller: %w", err)
		}
		logger.Info("history cleanup enabled", "expiration", historyExpiration.String())
		startHistoryInformers = func() { historyInformerFactory.Start(ctx.Done()) }
	} else {
		startHistoryInformers = func() {}
	}

	// Start informers
	go jobInformerFactory.Start(ctx.Done())
	go startHistoryInformers()

	// Optionally wait for job cache sync; history cleanup can rely on resync events
	if !cache.WaitForCacheSync(ctx.Done(), jobInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync job informer cache")
	}

	<-ctx.Done()
	return nil
}

func buildTLSConfig(insecure bool, certFile, keyFile, caFile string) (rest.TLSClientConfig, error) {
	tlsConfig := rest.TLSClientConfig{
		Insecure: insecure,
	}

	// If client certificate and key are provided
	if certFile != "" && keyFile != "" {
		tlsConfig.CertFile = certFile
		tlsConfig.KeyFile = keyFile
	}

	// If CA certificate is provided
	if caFile != "" {
		caCert, err := os.ReadFile(caFile)
		if err != nil {
			return tlsConfig, fmt.Errorf("failed to read CA certificate file: %w", err)
		}

		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return tlsConfig, fmt.Errorf("failed to parse CA certificate")
		}

		tlsConfig.CAData = caCert
	}

	return tlsConfig, nil
}
