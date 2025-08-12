package main

import (
	"context"
	"flag"
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
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	utilnet "k8s.io/apimachinery/pkg/util/net"
	"k8s.io/apimachinery/pkg/util/wait"
	"k8s.io/client-go/rest"
	k8srest "k8s.io/client-go/rest"
	"k8s.io/client-go/tools/cache"
	"k8s.io/client-go/transport"
	"k8s.io/client-go/util/workqueue"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	client "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned"
	typedclient "github.com/grafana/grafana/apps/provisioning/pkg/generated/clientset/versioned/typed/provisioning/v0alpha1"
	informer "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions"
	informerv0alpha1 "github.com/grafana/grafana/apps/provisioning/pkg/generated/informers/externalversions/provisioning/v0alpha1"
	listers "github.com/grafana/grafana/apps/provisioning/pkg/generated/listers/provisioning/v0alpha1"
)

var (
	token                 = flag.String("token", "", "Token to use for authentication")
	tokenExchangeURL      = flag.String("token-exchange-url", "", "Token exchange URL")
	provisioningServerURL = flag.String("provisioning-server-url", "", "Provisioning server URL")
)

func main() {
	app := &cli.App{
		Name:  "provisioning-controller",
		Usage: "Watch repositories and manage provisioning resources",
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
		},
		Action: runProvisioningController,
	}

	if err := app.Run(os.Args); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		os.Exit(1)
	}
}

func runProvisioningController(c *cli.Context) error {
	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: *tokenExchangeURL,
		Token:            *token,
	})
	if err != nil {
		return fmt.Errorf("failed to create token exchange client: %w", err)
	}

	config := &k8srest.Config{
		APIPath: "/apis",
		Host:    *provisioningServerURL,
		WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
			return &authRoundTripper{
				tokenExchangeClient: tokenExchangeClient,
				transport:           rt,
			}
		}),
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true, // TODO: make this configurable
		},
	}

	provisioningClient, err := client.NewForConfig(config)
	if err != nil {
		return fmt.Errorf("failed to create provisioning client: %w", err)
	}

	// TODO: make this configurable
	informerFactory := informer.NewSharedInformerFactoryWithOptions(
		provisioningClient,
		30*time.Second, // resync period
	)

	repoInformer := informerFactory.Provisioning().V0alpha1().Repositories()
	controller := NewRepositoryController(
		provisioningClient.ProvisioningV0alpha1(),
		repoInformer,
	)
	informerFactory.Start(context.Background().Done())
	if !cache.WaitForCacheSync(context.Background().Done(), repoInformer.Informer().HasSynced) {
		return fmt.Errorf("failed to sync informer cache")
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("Received shutdown signal, stopping controller")
		cancel()
	}()

	controller.Run(ctx)
	return nil
}

type RepositoryController struct {
	client     typedclient.ProvisioningV0alpha1Interface
	repoLister listers.RepositoryLister
	repoSynced cache.InformerSynced
	logger     logging.Logger
	queue      workqueue.RateLimitingInterface
}

func NewRepositoryController(
	provisioningClient typedclient.ProvisioningV0alpha1Interface,
	repoInformer informerv0alpha1.RepositoryInformer,
) *RepositoryController {
	controller := &RepositoryController{
		client:     provisioningClient,
		repoLister: repoInformer.Lister(),
		repoSynced: repoInformer.Informer().HasSynced,
		logger: logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelDebug,
		})),
		queue: workqueue.NewRateLimitingQueue(workqueue.DefaultControllerRateLimiter()),
	}

	repoInformer.Informer().AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: controller.enqueue,
		UpdateFunc: func(oldObj, newObj interface{}) {
			controller.enqueue(newObj)
		},
		DeleteFunc: controller.enqueue,
	})

	return controller
}

func (c *RepositoryController) Run(ctx context.Context) {
	defer c.queue.ShutDown()

	if !cache.WaitForCacheSync(ctx.Done(), c.repoSynced) {
		c.logger.Error("Failed to sync informer cache")
		return
	}

	go func() {
		wait.UntilWithContext(ctx, c.runWorker, time.Second)
		c.logger.Info("Worker stopped")
	}()

	<-ctx.Done()
}

func (c *RepositoryController) enqueue(obj interface{}) {
	key, err := cache.DeletionHandlingMetaNamespaceKeyFunc(obj)
	if err != nil {
		c.logger.Error("Couldn't get key for object", "error", err)
		return
	}

	eventType := "unknown"
	switch obj.(type) {
	case *provisioning.Repository:
		repo := obj.(*provisioning.Repository)
		if repo.DeletionTimestamp != nil {
			eventType = "delete"
		} else {
			eventType = "add/update"
		}
		c.logger.Debug("Received repository event",
			"event_type", eventType,
			"key", key,
			"namespace", repo.Namespace,
			"name", repo.Name,
			"generation", repo.Generation)
	}

	c.queue.Add(key)
}

func (c *RepositoryController) runWorker(ctx context.Context) {
	for c.processNextWorkItem(ctx) {
	}
}

func (c *RepositoryController) processNextWorkItem(ctx context.Context) bool {
	key, quit := c.queue.Get()
	if quit {
		return false
	}
	defer c.queue.Done(key)

	logger := c.logger.With("key", key)
	logger.Debug("Processing work item from queue")

	err := c.processRepository(ctx, key.(string))
	if err == nil {
		c.queue.Forget(key)
		logger.Debug("Successfully processed work item")
		return true
	}

	logger.Error("Failed to process repository", "error", err)
	c.queue.AddRateLimited(key)
	return true
}

func (c *RepositoryController) processRepository(ctx context.Context, key string) error {
	namespace, name, err := cache.SplitMetaNamespaceKey(key)
	if err != nil {
		return err
	}

	repo, err := c.repoLister.Repositories(namespace).Get(name)
	if err != nil {
		return err
	}
	c.logger.Debug("Processing repository",
		"namespace", repo.Namespace,
		"name", repo.Name,
		"type", repo.Spec.Type,
		"generation", repo.Generation,
		"observedGeneration", repo.Status.ObservedGeneration)

	if repo.Generation != repo.Status.ObservedGeneration {
		repo.Status.ObservedGeneration = repo.Generation

		_, err = c.client.Repositories(repo.Namespace).UpdateStatus(ctx, repo, metav1.UpdateOptions{})
		if err != nil {
			return err
		}

		// TODO: do a lot more here :)
		c.logger.Debug("Updated repository status",
			"namespace", repo.Namespace,
			"name", repo.Name,
			"observedGeneration", repo.Status.ObservedGeneration)
	}

	return nil
}

type authRoundTripper struct {
	tokenExchangeClient *authn.TokenExchangeClient
	transport           http.RoundTripper
}

func (t *authRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	tokenResponse, err := t.tokenExchangeClient.Exchange(req.Context(), authn.TokenExchangeRequest{
		Audiences: []string{provisioning.GROUP},
		Namespace: "*",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}

	req = utilnet.CloneRequest(req)

	req.Header.Set("X-Access-Token", "Bearer "+tokenResponse.Token)
	return t.transport.RoundTrip(req)
}
