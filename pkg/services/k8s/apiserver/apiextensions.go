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
	"crypto/x509"
	"net"
	"net/url"
	"os"
	"time"

	"github.com/grafana/grafana/pkg/services/certgenerator"
	oteltrace "go.opentelemetry.io/otel/trace"
	v1 "k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1"
	"k8s.io/apiextensions-apiserver/pkg/apis/apiextensions/v1beta1"
	apiextensionsapiserver "k8s.io/apiextensions-apiserver/pkg/apiserver"
	apiextensionsserveroptions "k8s.io/apiextensions-apiserver/pkg/cmd/server/options"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/authentication/authenticator"
	"k8s.io/apiserver/pkg/authentication/request/headerrequest"
	"k8s.io/apiserver/pkg/authentication/user"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/apiserver/pkg/server/options"
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
	o.RecommendedOptions.Authorization.AlwaysAllowGroups = []string{user.SystemPrivilegedGroup, "grafana"}
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
		Host:        "https://localhost:2999/k8s/",
		BearerToken: "glsa_c4q6slmv92YMkya2uNLdIF84o431p58v_2819eb90",
	}

	rootCert, err := certUtil.GetK8sCACert()
	if err != nil {
		return apiextensionsapiserver.Config{}, err
	}

	authenticator, err := newAuthenticator(rootCert)
	if err != nil {
		return apiextensionsapiserver.Config{}, err
	}
	serverConfig.Authentication.Authenticator = authenticator

	if err := o.APIEnablement.ApplyTo(
		&serverConfig.Config,
		apiextensionsapiserver.DefaultAPIResourceConfigSource(),
		apiextensionsapiserver.Scheme); err != nil {
		return apiextensionsapiserver.Config{}, err
	}

	serverConfig.SharedInformerFactory = informers.NewSharedInformerFactory(fake.NewSimpleClientset(), 10*time.Minute)
	serviceResolver := &serviceResolver{serverConfig.SharedInformerFactory.Core().V1().Services().Lister()}
	serverConfig.RESTOptionsGetter = &restOptionsGetter{
		codec: apiextensionsapiserver.Codecs.LegacyCodec(v1beta1.SchemeGroupVersion, v1.SchemeGroupVersion),
	}

	apiextensionsConfig := apiextensionsapiserver.Config{
		GenericConfig: serverConfig,
		ExtraConfig: apiextensionsapiserver.ExtraConfig{
			CRDRESTOptionsGetter: &restOptionsGetter{codec: unstructured.UnstructuredJSONScheme},
			MasterCount:          1,
			ServiceResolver:      serviceResolver,
			AuthResolverWrapper:  webhook.NewDefaultAuthenticationInfoResolverWrapper(nil, nil, serverConfig.LoopbackClientConfig, oteltrace.NewNoopTracerProvider()),
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

func newAuthenticator(cert *x509.Certificate) (authenticator.Request, error) {
	reqHeaderOptions := options.RequestHeaderAuthenticationOptions{
		UsernameHeaders:     []string{"X-Remote-User"},
		GroupHeaders:        []string{"X-Remote-Group"},
		ExtraHeaderPrefixes: []string{"X-Remote-Extra-"},
	}

	requestHeaderAuthenticator, err := headerrequest.New(
		reqHeaderOptions.UsernameHeaders,
		reqHeaderOptions.GroupHeaders,
		reqHeaderOptions.ExtraHeaderPrefixes,
	)
	if err != nil {
		return nil, err
	}

	return requestHeaderAuthenticator, nil
}
