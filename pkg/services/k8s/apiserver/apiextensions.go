/*
Copyright 2017 The Kubernetes Authors.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

// Package app does all of the work necessary to create a Kubernetes
// APIServer by binding together the API, master and APIServer infrastructure.
// It can be configured and called directly or via the hyperkube framework.
package apiserver

import (
	"net"
	"net/url"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/services/certgenerator"
	apiextensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	apiextensionsserveroptions "k8s.io/apiextensions-apiserver/pkg/cmd/server/options"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	serveroptions "k8s.io/apiserver/pkg/server/options"
	"k8s.io/apiserver/pkg/storage/storagebackend"
	"k8s.io/apiserver/pkg/util/proxy"
	"k8s.io/apiserver/pkg/util/webhook"
	"k8s.io/client-go/informers"
	"k8s.io/client-go/kubernetes/fake"
	corev1 "k8s.io/client-go/listers/core/v1"
	"k8s.io/client-go/rest"
)

func createAPIExtensionsConfig(dataPath string) (apiextensionsapiserver.Config, error) {
	o := apiextensionsserveroptions.NewCustomResourceDefinitionsServerOptions(os.Stdout, os.Stderr)
	o.RecommendedOptions.SecureServing.BindPort = 6443
	o.RecommendedOptions.Authentication.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.RemoteKubeConfigFileOptional = true
	o.RecommendedOptions.Authorization.AlwaysAllowPaths = []string{"*"}
	o.RecommendedOptions.Authorization.AlwaysAllowGroups = []string{"system:unauthenticated", "system:apiserver"}
	o.RecommendedOptions.CoreAPI = nil
	o.RecommendedOptions.Admission = nil
	o.RecommendedOptions.Etcd = nil

	// Get the util to get the paths to pre-generated certs
	certUtil := certgenerator.CertUtil{
		K8sDataPath: dataPath,
	}

	o.RecommendedOptions.SecureServing.BindAddress = net.ParseIP(certgenerator.DefaultAPIServerIp)
	o.RecommendedOptions.SecureServing.ServerCert.CertKey = serveroptions.CertKey{
		CertFile: certUtil.APIServerCertFile(),
		KeyFile:  certUtil.APIServerKeyFile(),
	}

	if err := o.Complete(); err != nil {
		return apiextensionsapiserver.Config{}, err
	}

	if err := o.Validate(); err != nil {
		return apiextensionsapiserver.Config{}, err
	}

	serverConfig := genericapiserver.NewRecommendedConfig(apiextensionsapiserver.Codecs)
	if err := o.RecommendedOptions.ApplyTo(serverConfig); err != nil {
		return apiextensionsapiserver.Config{}, err
	}

	serverConfig.LoopbackClientConfig = &rest.Config{
		TLSClientConfig: rest.TLSClientConfig{
			Insecure: true,
		},
		Host:     DefaultAPIServerHost,
		Username: "grafana",
		Password: "grafana",
	}

	serverConfig.SharedInformerFactory = informers.NewSharedInformerFactory(fake.NewSimpleClientset(), 10*time.Minute)

	if err := o.APIEnablement.ApplyTo(
		&serverConfig.Config,
		apiextensionsapiserver.DefaultAPIResourceConfigSource(),
		apiextensionsapiserver.Scheme); err != nil {
		return apiextensionsapiserver.Config{}, err
	}

	serviceResolver := &serviceResolver{serverConfig.SharedInformerFactory.Core().V1().Services().Lister()}

	var crdRESTOptionsGetter generic.RESTOptionsGetter
	// TODO: figure out how to replace this
	//crdRESTOptionsGetter, err := apiextensionsserveroptions.NewCRDRESTOptionsGetter(*o.RecommendedOptions.Etcd)
	//if err != nil {
	//	return apiextensionsapiserver.Config{}, err
	//}

	apiextensionsConfig := apiextensionsapiserver.Config{
		GenericConfig: serverConfig,
		ExtraConfig: apiextensionsapiserver.ExtraConfig{
			CRDRESTOptionsGetter: crdRESTOptionsGetter,
			MasterCount:          1,
			ServiceResolver:      serviceResolver,
			AuthResolverWrapper:  authWrapperFactory(serverConfig.LoopbackClientConfig),
		},
	}

	// we need to clear the poststarthooks so we don't add them multiple times to all the servers (that fails)
	apiextensionsConfig.GenericConfig.PostStartHooks = map[string]genericapiserver.PostStartHookConfigEntry{}

	return apiextensionsConfig, nil
}

func createAPIExtensionsServer(apiextensionsConfig *apiextensionsapiserver.Config, delegateAPIServer genericapiserver.DelegationTarget) (*apiextensionsapiserver.CustomResourceDefinitions, error) {
	return apiextensionsConfig.Complete().New(delegateAPIServer)
}

type serviceResolver struct {
	services corev1.ServiceLister
}

func (r *serviceResolver) ResolveEndpoint(namespace, name string, port int32) (*url.URL, error) {
	return proxy.ResolveCluster(r.services, namespace, name, port)
}

func authWrapperFactory(conf *rest.Config) webhook.AuthenticationInfoResolverWrapper {
	return func(webhook.AuthenticationInfoResolver) webhook.AuthenticationInfoResolver {
		return &authResolver{config: conf}
	}
}

type authResolver struct {
	config *rest.Config
}

func (a *authResolver) ClientConfigFor(hostPort string) (*rest.Config, error) {
	return a.config, nil
}

func (a *authResolver) ClientConfigForService(serviceName, serviceNamespace string, servicePort int) (*rest.Config, error) {
	return a.config, nil
}

type restOptionsGetter struct {
	codec runtime.Codec
}

func (r restOptionsGetter) GetRESTOptions(resource schema.GroupResource) (generic.RESTOptions, error) {
	return generic.RESTOptions{
		StorageConfig: &storagebackend.ConfigForResource{
			GroupResource: resource,
			Config: storagebackend.Config{
				Codec: r.codec,
			},
		},
	}, nil
}
