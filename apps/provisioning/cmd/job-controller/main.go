package main

import (
	"context"
	"flag"
	"fmt"
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

	authrt "github.com/grafana/grafana/apps/provisioning/pkg/auth"
	"github.com/grafana/grafana/apps/provisioning/pkg/controller"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
)

var (
	token                 = flag.String("token", "", "Token to use for authentication")
	tokenExchangeURL      = flag.String("token-exchange-url", "", "Token exchange URL")
	provisioningServerURL = flag.String("provisioning-server-url", "", "Provisioning server URL")
)

func main() {
	app := &cli.App{
		Name:  "job-controller",
		Usage: "Watch provisioning jobs and manage job history cleanup",
		Flags: []cli.Flag{
			&cli.StringFlag{
				Name:        "token",
				Usage:       "Token to use for authentication",
				Value:       "",
				Destination: token,
			},
			&cli.StringFlag{
				Name:        "token-exchange-url",
				Usage:       "Token exchange URL",
				Value:       "",
				Destination: tokenExchangeURL,
			},
			&cli.StringFlag{
				Name:        "provisioning-server-url",
				Usage:       "Provisioning server URL",
				Value:       "",
				Destination: provisioningServerURL,
			},
			&cli.DurationFlag{
				Name:  "history-expiration",
				Usage: "Duration after which HistoricJobs are deleted; 0 disables cleanup. When the Provisioning API is configured to use Loki for job history, leave this at 0.",
				Value: 0,
			},
		},
		Action: runJobController,
	}

	if err := app.Run(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func runJobController(c *cli.Context) error {
	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: *tokenExchangeURL,
		Token:            *token,
	})
	if err != nil {
		return fmt.Errorf("failed to create token exchange client: %w", err)
	}

	config := &rest.Config{
		APIPath: "/apis",
		Host:    *provisioningServerURL,
		WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
			return authrt.NewRoundTripper(tokenExchangeClient, rt)
		}),
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true, // TODO: make this configurable
		},
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

	// TODO: Wire notifications into a ConcurrentJobDriver when a client-backed Store and Workers are available.
	// For now, just log notifications to verify events end-to-end.
	logger := logging.DefaultLogger.With("logger", "provisioning-job-controller")
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
