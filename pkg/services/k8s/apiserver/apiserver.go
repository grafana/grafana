package apiserver

import (
	v1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1beta1"
	apiextensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
	"k8s.io/client-go/rest"
	"k8s.io/kubernetes/pkg/api/legacyscheme"
)

func (s *service) apiserverConfig() (*options.RecommendedOptions, *genericapiserver.RecommendedConfig, error) {
	serverRunOptions := options.NewServerRunOptions()
	recommendedOptions := options.NewRecommendedOptions(
		"/registry/apiextensions.kubernetes.io",
		legacyscheme.Codecs.LegacyCodec(v1beta1.SchemeGroupVersion, v1.SchemeGroupVersion),
	)

	etcdConfig := s.etcdProvider.GetConfig()
	recommendedOptions.Etcd.StorageConfig.Transport.ServerList = etcdConfig.Endpoints
	recommendedOptions.Etcd.StorageConfig.Transport.CertFile = etcdConfig.TLSConfig.CertFile
	recommendedOptions.Etcd.StorageConfig.Transport.KeyFile = etcdConfig.TLSConfig.KeyFile
	recommendedOptions.Etcd.StorageConfig.Transport.TrustedCAFile = etcdConfig.TLSConfig.CAFile

	serverConfig := genericapiserver.NewRecommendedConfig(apiextensionsapiserver.Codecs)
	if err := serverRunOptions.ApplyTo(&serverConfig.Config); err != nil {
		return nil, nil, err
	}
	if err := recommendedOptions.ApplyTo(serverConfig); err != nil {
		return nil, nil, err
	}
	serverConfig.ExternalAddress = "127.0.0.1:6443"
	serverConfig.LoopbackClientConfig = &rest.Config{
		Host: "http://127.0.0.1:6443",
	}
	return recommendedOptions, serverConfig, nil
}
