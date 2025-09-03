package iam

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	"github.com/grafana/grafana/apps/iam/pkg/app"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/urfave/cli/v2"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/authlib/authn"
	"github.com/grafana/grafana-app-sdk/plugin/kubeconfig"
	utilnet "k8s.io/apimachinery/pkg/util/net"
)

func init() {
	server.RegisterOperator(server.Operator{
		Name:        "iam-folder-reconciler",
		Description: "Watch folder resources and manage IAM permissions with Zanzana",
		RunFunc:     RunIAMFolderReconciler,
	})
}

func RunIAMFolderReconciler(opts standalone.BuildInfo, c *cli.Context, cfg *setting.Cfg) error {
	logger := logging.NewSLogLogger(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	})).With("logger", "iam-folder-reconciler")
	logger.Info("Starting IAM folder reconciler operator")

	// Get configuration from Grafana settings
	iamConfig, err := buildIAMConfigFromSettings(cfg)
	if err != nil {
		return fmt.Errorf("failed to build IAM config: %w", err)
	}

	runner, err := operator.NewRunner(iamConfig.RunnerConfig)
	if err != nil {
		logger.Error("failed to create IAM operator runner", "error", err)
		return fmt.Errorf("failed to create IAM operator runner: %w", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	go func() {
		<-sigChan
		fmt.Println("Received shutdown signal, stopping IAM operator")
		cancel()
	}()

	logger.Info("Starting IAM folder reconciler")
	err = runner.Run(ctx, app.Provider(iamConfig.AppConfig))
	if err != nil && !errors.Is(err, context.Canceled) {
		return fmt.Errorf("IAM operator exited with error: %w", err)
	}

	logger.Info("IAM folder reconciler stopped")
	return nil
}

type iamConfig struct {
	RunnerConfig operator.RunnerConfig
	AppConfig    app.AppConfig
}

const (
	ConnTypeGRPC = "grpc"
	ConnTypeHTTP = "http"
)

func buildIAMConfigFromSettings(cfg *setting.Cfg) (*iamConfig, error) {
	var err error
	if cfg == nil {
		return nil, fmt.Errorf("no configuration available")
	}

	iamCfg := iamConfig{}

	iamFolderReconcilerSec := cfg.SectionWithEnvOverrides("iam_folder_reconciler")

	zanzanaAddress := iamFolderReconcilerSec.Key("zanzana_address").MustString("")
	if zanzanaAddress == "" {
		return nil, fmt.Errorf("address is required in [iam_folder_reconciler.zanzana] section")
	}
	iamCfg.AppConfig.ZanzanaClientCfg.Address = zanzanaAddress

	tokenExchangeURL := iamFolderReconcilerSec.Key("token_exchange_url").MustString("")
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [iam_folder_reconciler] section")
	}
	iamCfg.AppConfig.ZanzanaClientCfg.TokenExchangeURL = tokenExchangeURL

	token := iamFolderReconcilerSec.Key("token").MustString("")
	if token == "" {
		return nil, fmt.Errorf("token is required in [iam_folder_reconciler] section")
	}
	iamCfg.AppConfig.ZanzanaClientCfg.Token = token

	folderAppURL := iamFolderReconcilerSec.Key("folder_app_url").MustString("")
	folderAppNamespace := iamFolderReconcilerSec.Key("folder_app_namespace").MustString("default")

	kubeConfig, err := buildKubeConfigFromFolderAppURL(folderAppURL, tokenExchangeURL, token, folderAppNamespace)
	if err != nil {
		return nil, fmt.Errorf("failed to build kube config: %w", err)
	}
	iamCfg.RunnerConfig.KubeConfig = kubeConfig.RestConfig

	wenhookSection := cfg.SectionWithEnvOverrides("iam_folder_reconciler.webhook_server")
	webhookPort := wenhookSection.Key("port").MustInt(8443)
	webhookCertPath := wenhookSection.Key("cert_path").MustString("")
	webhookKeyPath := wenhookSection.Key("key_path").MustString("")
	iamCfg.RunnerConfig.WebhookConfig = operator.RunnerWebhookConfig{
		Port: webhookPort,
		TLSConfig: k8s.TLSConfig{
			CertPath: webhookCertPath,
			KeyPath:  webhookKeyPath,
		},
	}

	return &iamCfg, nil
}

func buildKubeConfigFromFolderAppURL(folderAppURL, exchangeUrl, authToken, namespace string) (*kubeconfig.NamespacedConfig, error) {
	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: exchangeUrl,
		Token:            authToken,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	return &kubeconfig.NamespacedConfig{
		RestConfig: rest.Config{
			APIPath: "/apis",
			Host:    folderAppURL,
			WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
				return &authRoundTripper{
					tokenExchangeClient: tokenExchangeClient,
					transport:           rt,
				}
			}),
			TLSClientConfig: rest.TLSClientConfig{
				Insecure: true,
			},
		},
		Namespace: namespace,
	}, nil
}

type authRoundTripper struct {
	tokenExchangeClient *authn.TokenExchangeClient
	transport           http.RoundTripper
}

func (t *authRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	tokenResponse, err := t.tokenExchangeClient.Exchange(req.Context(), authn.TokenExchangeRequest{
		Audiences: []string{"folder.grafana.app"},
		Namespace: "*",
	})
	if err != nil {
		return nil, fmt.Errorf("failed to exchange token: %w", err)
	}

	// clone the request as RTs are not expected to mutate the passed request
	req = utilnet.CloneRequest(req)

	req.Header.Set("X-Access-Token", "Bearer "+tokenResponse.Token)
	return t.transport.RoundTrip(req)
}
