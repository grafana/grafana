package satokenscontroller

import (
	"context"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"fmt"
	"github.com/grafana/grafana/pkg/services/certgenerator"
	"os"
	"path/filepath"
	"time"
)

import (
	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/modules"
	"github.com/grafana/grafana/pkg/services/k8s/apiserver"
	"github.com/grafana/grafana/pkg/setting"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes"
	serviceaccountcontroller "k8s.io/kubernetes/pkg/controller/serviceaccount"
	"k8s.io/kubernetes/pkg/serviceaccount"
)

var (
	_ Service = (*service)(nil)
)

type Service interface {
	services.NamedService
}

type service struct {
	*services.BasicService
	restConfigProvider apiserver.RestConfigProvider
	stopCh             chan struct{}
}

func ProvideService(cfg *setting.Cfg, restConfigProvider apiserver.RestConfigProvider) (*service, error) {
	s := &service{
		stopCh:             make(chan struct{}),
		restConfigProvider: restConfigProvider,
	}

	s.BasicService = services.NewBasicService(s.start, s.running, nil).WithName(modules.KubernetesSATokensCtrl)

	return s, nil
}

func loadExistingCertPKI(certPath string, keyPath string) (*x509.Certificate, *rsa.PrivateKey, error) {
	certPemBytes, err := os.ReadFile(filepath.Clean(certPath))
	if err != nil {
		return nil, nil, fmt.Errorf("error reading existing Cert: %s", err.Error())
	}

	keyPemBytes, err := os.ReadFile(filepath.Clean(keyPath))
	if err != nil {
		return nil, nil, fmt.Errorf("error reading existing Key: %s", err.Error())
	}

	certBlock, _ := pem.Decode(certPemBytes)

	cert, err := x509.ParseCertificate(certBlock.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("error parsing existing Cert: %s", err.Error())
	}

	keyBlock, _ := pem.Decode(keyPemBytes)
	if err != nil {
		return nil, nil, fmt.Errorf("error parsing existing Key into pem: %s", err.Error())
	}

	key, err := x509.ParsePKCS1PrivateKey(keyBlock.Bytes)
	if err != nil {
		return nil, nil, fmt.Errorf("error parsing existing Key from pem: %s", err.Error())
	}

	key.PublicKey = *(cert.PublicKey.(*rsa.PublicKey))

	return cert, key, nil
}

func (s *service) start(ctx context.Context) error {
	restConfig := s.restConfigProvider.GetRestConfig()

	clientSet, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		return err
	}

	_, key, err := loadExistingCertPKI("data/k8s/token-signing.apiserver.crt", "data/k8s/token-signing.apiserver.key")
	if err != nil {
		return err
	}
	tokenGenerator, err := serviceaccount.JWTTokenGenerator(serviceaccount.LegacyIssuer, key)
	if err != nil {
		return fmt.Errorf("failed to build token generator: %v", err)
	}

	factory := informers.NewSharedInformerFactory(clientSet, 10*time.Minute)

	cu := certgenerator.CertUtil{}

	controller, err := serviceaccountcontroller.NewTokensController(
		factory.Core().V1().ServiceAccounts(),
		factory.Core().V1().Secrets(),
		clientSet,
		serviceaccountcontroller.TokensControllerOptions{
			TokenGenerator: tokenGenerator,
			RootCA:         cu.CACertPem(),
			AutoGenerate:   true,
		},
	)

	go controller.Run(1, s.stopCh)

	factory.Start(ctx.Done())

	return nil
}

func (s *service) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		close(s.stopCh)
	}
	return nil
}
