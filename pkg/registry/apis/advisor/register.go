package advisor

import (
	"fmt"
	"time"

	advisorv0alpha1 "github.com/grafana/grafana/apps/advisor/pkg/apis/advisor/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/registry/apps/advisor"
	"github.com/grafana/grafana/pkg/services/apiserver/builder"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apiserver/pkg/registry/rest"
	genericapiserver "k8s.io/apiserver/pkg/server"
	"k8s.io/kube-openapi/pkg/common"
)

// advisorAPIBuilder wraps AdvisorAppProvider to implement builder.APIGroupBuilder
type AdvisorAPIBuilder struct {
	*advisor.AdvisorAppProvider
}

var CheckResourceInfo = utils.NewResourceInfo(advisorv0alpha1.APIGroup, advisorv0alpha1.APIVersion,
	"checks", "check", "Check",
	func() runtime.Object { return &advisorv0alpha1.Check{} },
	func() runtime.Object { return &advisorv0alpha1.CheckList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Host", Type: "string", Format: "string", Description: "The service host"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*advisorv0alpha1.Check)
			if !ok {
				return nil, fmt.Errorf("expected check")
			}
			return []interface{}{
				m.Name,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	}, // default table converter
)

var CheckTypeResourceInfo = utils.NewResourceInfo(advisorv0alpha1.APIGroup, advisorv0alpha1.APIVersion,
	"checktypes", "checktype", "CheckType",
	func() runtime.Object { return &advisorv0alpha1.CheckType{} },
	func() runtime.Object { return &advisorv0alpha1.CheckTypeList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Steps", Type: "string", Format: "string", Description: "The check type steps"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*advisorv0alpha1.CheckType)
			if !ok {
				return nil, fmt.Errorf("expected check type")
			}
			return []interface{}{
				m.Name,
				m.Spec.Steps,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	}, // default table converter
)

func (a *AdvisorAPIBuilder) AllowedV0Alpha1Resources() []string {
	return []string{builder.AllResourcesAllowed}
}

func (a *AdvisorAPIBuilder) InstallSchema(scheme *runtime.Scheme) error {
	gv := advisorv0alpha1.GroupVersion
	err := advisorv0alpha1.AddToScheme(scheme)
	if err != nil {
		return err
	}

	metav1.AddToGroupVersion(scheme, gv)
	return scheme.SetVersionPriority(gv)
}

func (a *AdvisorAPIBuilder) UpdateAPIGroupInfo(apiGroupInfo *genericapiserver.APIGroupInfo, opts builder.APIGroupOptions) error {
	resourceInfo := CheckResourceInfo
	resourceInfoType := CheckTypeResourceInfo
	storage := map[string]rest.Storage{}

	// Create custom storage that doesn't require RESTOptionsGetter
	// Similar to how ofrep and datasource APIs work
	// TODO: This should use unified storage instead
	storage[resourceInfo.StoragePath()] = &advisorStorage{
		resourceInfo:   resourceInfo,
		tableConverter: resourceInfo.TableConverter(),
		items:          make(map[string]runtime.Object),
	}

	storage[resourceInfoType.StoragePath()] = &advisorStorage{
		resourceInfo:   resourceInfoType,
		tableConverter: resourceInfoType.TableConverter(),
		items:          make(map[string]runtime.Object),
	}

	apiGroupInfo.VersionedResourcesStorageMap[advisorv0alpha1.APIVersion] = storage
	return nil
}

func (a *AdvisorAPIBuilder) GetOpenAPIDefinitions() common.GetOpenAPIDefinitions {
	// Return the advisor OpenAPI definitions function
	return advisorv0alpha1.GetOpenAPIDefinitions
}

func (a *AdvisorAPIBuilder) GetGroupVersion() schema.GroupVersion {
	return advisorv0alpha1.GroupVersion
}
