package grafanaapiserver

import (
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/apiserver/pkg/registry/generic"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
	"k8s.io/kube-openapi/pkg/spec3"
)

// TODO: this (or something like it) belongs in grafana-app-sdk,
// but lets keep it here while we iterate on a few simple examples
type APIGroupBuilder interface {
	// Add the kinds to the server scheme
	InstallSchema(scheme *runtime.Scheme) error

	// Build the group+version behavior
	GetAPIGroupInfo(
		scheme *runtime.Scheme,
		codecs serializer.CodecFactory, // pointer?
		optsGetter generic.RESTOptionsGetter,
	) (*genericapiserver.APIGroupInfo, error)

	// Get OpenAPI definitions
	GetOpenAPIDefinitions() common.GetOpenAPIDefinitions

	// Register additional routes with the server
	GetOpenAPIPostProcessor() func(*spec3.OpenAPI) (*spec3.OpenAPI, error)
}
