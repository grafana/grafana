package iam

import (
	"context"
	"crypto/x509"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/grafana/grafana-app-sdk/logging"
	"github.com/grafana/grafana-app-sdk/operator"
	folder "github.com/grafana/grafana/apps/folder/pkg/apis/folder/v1beta1"
	"github.com/grafana/grafana/apps/iam/pkg/app"
	"github.com/grafana/grafana/pkg/server"
	"github.com/grafana/grafana/pkg/services/apiserver/standalone"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/urfave/cli/v2"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/transport"

	"github.com/grafana/authlib/authn"
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

func buildIAMConfigFromSettings(cfg *setting.Cfg) (*iamConfig, error) {
	if cfg == nil {
		return nil, fmt.Errorf("no configuration available")
	}

	iamCfg := iamConfig{}

	gRPCAuth := cfg.SectionWithEnvOverrides("grpc_client_authentication")
	token := gRPCAuth.Key("token").String()
	if token == "" {
		return nil, fmt.Errorf("token is required in [grpc_client_authentication] section")
	}
	iamCfg.AppConfig.ZanzanaClientCfg.Token = token

	tokenExchangeURL := gRPCAuth.Key("token_exchange_url").String()
	if tokenExchangeURL == "" {
		return nil, fmt.Errorf("token_exchange_url is required in [grpc_client_authentication] section")
	}
	iamCfg.AppConfig.ZanzanaClientCfg.TokenExchangeURL = tokenExchangeURL

	operatorSec := cfg.SectionWithEnvOverrides("operator")

	zanzanaURL := operatorSec.Key("zanzana_url").MustString("")
	if zanzanaURL == "" {
		return nil, fmt.Errorf("zanzana_url is required in [operator] section")
	}
	iamCfg.AppConfig.ZanzanaClientCfg.URL = zanzanaURL

	folderAppURL := operatorSec.Key("folder_app_url").MustString("")
	if folderAppURL == "" {
		return nil, fmt.Errorf("folder_app_url is required in [operator] section")
	}

	tlsInsecure := operatorSec.Key("tls_insecure").MustBool(false)
	tlsCertFile := operatorSec.Key("tls_cert_file").String()
	tlsKeyFile := operatorSec.Key("tls_key_file").String()
	tlsCAFile := operatorSec.Key("tls_ca_file").String()
	iamCfg.AppConfig.ZanzanaClientCfg.ServerCertFile = tlsCertFile

	kubeConfig, err := buildKubeConfigFromFolderAppURL(
		folderAppURL,
		tokenExchangeURL, token,
		tlsInsecure, tlsCertFile, tlsKeyFile, tlsCAFile,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to build kube config: %w", err)
	}
	iamCfg.RunnerConfig.KubeConfig = *kubeConfig

	metricsSection := cfg.SectionWithEnvOverrides("metrics")
	iamCfg.RunnerConfig.MetricsConfig.Enabled = metricsSection.Key("enabled").MustBool(true)

	return &iamCfg, nil
}

func buildKubeConfigFromFolderAppURL(
	folderAppURL string,
	exchangeUrl, authToken string,
	tlsInsecure bool, tlsCertFile, tlsKeyFile, tlsCAFile string,
) (*rest.Config, error) {
	tokenExchangeClient, err := authn.NewTokenExchangeClient(authn.TokenExchangeConfig{
		TokenExchangeURL: exchangeUrl,
		Token:            authToken,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create token exchange client: %w", err)
	}

	tlsConfig, err := buildTLSConfig(tlsInsecure, tlsCertFile, tlsKeyFile, tlsCAFile)
	if err != nil {
		return nil, fmt.Errorf("failed to build TLS configuration: %w", err)
	}

	return &rest.Config{
		APIPath: "/apis",
		Host:    folderAppURL,
		WrapTransport: transport.WrapperFunc(func(rt http.RoundTripper) http.RoundTripper {
			return &authRoundTripper{
				tokenExchangeClient: tokenExchangeClient,
				transport:           rt,
			}
		}),
		TLSClientConfig: tlsConfig,
	}, nil
}

func buildTLSConfig(insecure bool, certFile, keyFile, caFile string) (rest.TLSClientConfig, error) {
	tlsConfig := rest.TLSClientConfig{
		Insecure: insecure,
	}

	if certFile != "" && keyFile != "" {
		tlsConfig.CertFile = certFile
		tlsConfig.KeyFile = keyFile
	}

	if caFile != "" {
		// caFile is set in operator.ini file
		// nolint:gosec
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

type authRoundTripper struct {
	tokenExchangeClient *authn.TokenExchangeClient
	transport           http.RoundTripper
}

func (t *authRoundTripper) RoundTrip(req *http.Request) (*http.Response, error) {
	tokenResponse, err := t.tokenExchangeClient.Exchange(req.Context(), authn.TokenExchangeRequest{
		Audiences: []string{folder.GROUP},
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
