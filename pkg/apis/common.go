package apis

import (
	"fmt"
	"strconv"
	"strings"

	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/serializer"
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
	) *genericapiserver.APIGroupInfo

	// Get OpenAPI definitions
	GetOpenAPIDefinitions() common.GetOpenAPIDefinitions

	// Register additional routes with the server
	GetOpenAPIPostProcessor() func(*spec3.OpenAPI) (*spec3.OpenAPI, error)
}

func OrgIdToNamespace(orgId int64) string {
	if orgId > 1 {
		return fmt.Sprintf("org-%d", orgId)
	}
	return "default"
}

func NamespaceToOrgID(ns string) (int64, error) {
	parts := strings.Split(ns, "-")
	switch len(parts) {
	case 1:
		if parts[0] == "default" {
			return 1, nil
		}
		if parts[0] == "" {
			return 0, nil // no orgId, cluster scope
		}
		return 0, fmt.Errorf("invalid namespace (expected default)")
	case 2:
		if !(parts[0] == "org" || parts[0] == "tenant") {
			return 0, fmt.Errorf("invalid namespace (org|tenant)")
		}
		n, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid namepscae (%w)", err)
		}
		return n, nil
	}
	return 0, fmt.Errorf("invalid namespace (%d parts)", len(parts))
}
