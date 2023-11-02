package main

import (
	"context"
	"fmt"
	"net"
	"os"
	"path/filepath"

	"k8s.io/apiserver/pkg/endpoints/openapi"
	"k8s.io/apiserver/pkg/features"
	genericapiserver "k8s.io/apiserver/pkg/server"
	utilfeature "k8s.io/apiserver/pkg/util/feature"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	clientcmdapi "k8s.io/client-go/tools/clientcmd/api"
	"k8s.io/sample-apiserver/pkg/apiserver"
	"k8s.io/sample-apiserver/pkg/cmd/server"
	sampleopenapi "k8s.io/sample-apiserver/pkg/generated/openapi"
	netutils "k8s.io/utils/net"

	"github.com/grafana/grafana/pkg/services/grafana-apiserver/storage/file"
)

const (
	DefaultServerPort    = 6443
	DefaultAPIServerIp   = "127.0.0.1"
	DefaultAPIServerHost = "http://" + DefaultAPIServerIp + ":6443"
)

func main() {
	ctx := context.Background()

	if err := run(ctx); err != nil {
		panic(err)
	}
}

func run(ctx context.Context) error {
	o := server.NewWardleServerOptions(os.Stdout, os.Stderr)

	o.RecommendedOptions.Etcd.SkipHealthEndpoints = true
	o.RecommendedOptions.SecureServing.BindAddress = net.ParseIP(DefaultAPIServerIp)
	o.RecommendedOptions.SecureServing.BindPort = DefaultServerPort
	o.RecommendedOptions.SecureServing.ServerCert.CertDirectory = "./certs"

	if err := o.RecommendedOptions.SecureServing.MaybeDefaultWithSelfSignedCerts("localhost", o.AlternateDNS, []net.IP{netutils.ParseIPSloppy("127.0.0.1")}); err != nil {
		return fmt.Errorf("error creating self-signed certificates: %v", err)
	}

	serverConfig := genericapiserver.NewRecommendedConfig(apiserver.Codecs)

	serverConfig.OpenAPIConfig = genericapiserver.DefaultOpenAPIConfig(sampleopenapi.GetOpenAPIDefinitions, openapi.NewDefinitionNamer(apiserver.Scheme))
	serverConfig.OpenAPIConfig.Info.Title = "Wardle"
	serverConfig.OpenAPIConfig.Info.Version = "0.1"

	if utilfeature.DefaultFeatureGate.Enabled(features.OpenAPIV3) {
		serverConfig.OpenAPIV3Config = genericapiserver.DefaultOpenAPIV3Config(sampleopenapi.GetOpenAPIDefinitions, openapi.NewDefinitionNamer(apiserver.Scheme))
		serverConfig.OpenAPIV3Config.Info.Title = "Wardle"
		serverConfig.OpenAPIV3Config.Info.Version = "0.1"
	}

	if err := o.RecommendedOptions.SecureServing.ApplyTo(&serverConfig.SecureServing, &serverConfig.LoopbackClientConfig); err != nil {
		return err
	}
	if err := o.RecommendedOptions.Etcd.ApplyTo(&serverConfig.Config); err != nil {
		return err
	}

	directory, err := os.Getwd() //get the current directory using the built-in function
	if err != nil {
		return err
	}
	optsGetter := file.NewRESTOptionsGetter(filepath.Join(directory, "data/sample-apiserver"), o.RecommendedOptions.Etcd.StorageConfig)
	serverConfig.RESTOptionsGetter = optsGetter

	cfg := &apiserver.Config{
		GenericConfig: serverConfig,
		ExtraConfig:   apiserver.ExtraConfig{},
	}

	completed := cfg.Complete()

	if err := writeKubeConfiguration(completed.GenericConfig.LoopbackClientConfig); err != nil {
		return err
	}

	server, err := completed.New()
	if err != nil {
		return err
	}

	return server.GenericAPIServer.PrepareRun().Run(ctx.Done())
}

func writeKubeConfiguration(restConfig *rest.Config) error {
	clusters := make(map[string]*clientcmdapi.Cluster)
	clusters["default-cluster"] = &clientcmdapi.Cluster{
		Server:                restConfig.Host,
		InsecureSkipTLSVerify: true,
	}

	contexts := make(map[string]*clientcmdapi.Context)
	contexts["default-context"] = &clientcmdapi.Context{
		Cluster:   "default-cluster",
		Namespace: "default",
		AuthInfo:  "default",
	}

	authinfos := make(map[string]*clientcmdapi.AuthInfo)
	authinfos["default"] = &clientcmdapi.AuthInfo{
		Token: restConfig.BearerToken,
	}

	clientConfig := clientcmdapi.Config{
		Kind:           "Config",
		APIVersion:     "v1",
		Clusters:       clusters,
		Contexts:       contexts,
		CurrentContext: "default-context",
		AuthInfos:      authinfos,
	}
	return clientcmd.WriteToFile(clientConfig, "./kubeconfig")
}
