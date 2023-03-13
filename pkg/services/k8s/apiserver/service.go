package apiserver

import (
	"context"
	"fmt"
	"net"
	"net/http"

	"github.com/grafana/dskit/services"
	"github.com/grafana/grafana/pkg/services/k8s/kine"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	genericapifilters "k8s.io/apiserver/pkg/endpoints/filters"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/util/notfoundhandler"
	"k8s.io/client-go/rest"
)

var _ Service = (*service)(nil)
var _ RestConfigProvider = (*service)(nil)

type Service interface {
	services.Service
}

type RestConfigProvider interface {
	GetRestConfig() *rest.Config
}

type service struct {
	*services.BasicService

	etcdProvider kine.EtcdProvider
	restConfig   *rest.Config

	stopCh    chan struct{}
	stoppedCh <-chan struct{}
}

var (
	// Scheme defines methods for serializing and deserializing API objects.
	Scheme = runtime.NewScheme()
	// Codecs provides methods for retrieving codecs and serializers for specific
	// versions and content types.
	Codecs = serializer.NewCodecFactory(Scheme)
)

func ProvideService(etcdProvider kine.EtcdProvider) (*service, error) {
	metav1.AddToGroupVersion(Scheme, schema.GroupVersion{Group: "", Version: "v1"})

	s := &service{
		etcdProvider: etcdProvider,
		stopCh:       make(chan struct{}),
	}

	s.BasicService = services.NewBasicService(s.start, s.running, nil)

	return s, nil
}

func (s *service) GetRestConfig() *rest.Config {
	return s.restConfig
}

func (s *service) start(ctx context.Context) error {
	apiConfig, err := s.apiserverConfig()
	if err != nil {
		return fmt.Errorf("failed to create apiserver config: %w", err)
	}
	extensionsServerConfig, err := s.extensionsServerConfig(*apiConfig)
	if err != nil {
		return fmt.Errorf("failed to create extensions server config: %w", err)
	}

	notFoundHandler := notfoundhandler.New(extensionsServerConfig.GenericConfig.Serializer, genericapifilters.NoMuxAndDiscoveryIncompleteKey)
	delegateAPIServer := genericapiserver.NewEmptyDelegateWithCustomHandler(notFoundHandler)

	extensionServer, err := extensionsServerConfig.Complete().New(delegateAPIServer)
	if err != nil {
		return err
	}

	apiServer, err := createAPIServer(apiConfig.ControlPlaneConfig, extensionServer.GenericAPIServer)

	aggregatorConfig, err := createAggregatorConfig(*apiConfig)
	if err != nil {
		return err
	}

	aggregatorServer, err := createAggregatorServer(aggregatorConfig, apiServer.GenericAPIServer, extensionServer.Informers)
	if err != nil {
		return err
	}

	prepared, err := aggregatorServer.PrepareRun()
	if err != nil {
		return err
	}

	l, err := net.Listen("tcp", "127.0.0.1:6443")
	if err != nil {
		return err
	}

	stoppedCh, _, err := genericapiserver.RunServer(&http.Server{
		Addr:           "127.0.0.1:6443",
		Handler:        prepared.GenericAPIServer.Handler,
		MaxHeaderBytes: 1 << 20,
	}, l, prepared.GenericAPIServer.ShutdownTimeout, s.stopCh)
	if err != nil {
		return err
	}
	s.stoppedCh = stoppedCh
	s.restConfig = apiConfig.Config.LoopbackClientConfig
	if err := prepared.Run(s.stopCh); err != nil {
		return err
	}

	fmt.Printf("K8s API server is running %v", s.restConfig)

	return nil
}

func (s *service) running(ctx context.Context) error {
	select {
	case <-ctx.Done():
		close(s.stopCh)
	case <-s.stoppedCh:
	}
	return nil
}
