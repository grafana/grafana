package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP      = "query.grafana.app"
	VERSION    = "v0alpha1"
	APIVERSION = GROUP + "/" + VERSION
)

var ConnectionResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"connections", "connection", "DataSourceConnection",
	func() runtime.Object { return &DataSourceConnection{} },
	func() runtime.Object { return &DataSourceConnectionList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "The datasource title"},
			{Name: "APIVersion", Type: "string", Format: "string", Description: "API Version"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]interface{}, error) {
			m, ok := obj.(*DataSourceConnection)
			if !ok {
				return nil, fmt.Errorf("expected connection")
			}
			return []interface{}{
				m.Name,
				m.Title,
				m.APIVersion,
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)

var DataSourceApiServerResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"datasourceapiservers", "datasourceapiserver", "DataSourceApiServer",
	func() runtime.Object { return &DataSourceApiServer{} },
	func() runtime.Object { return &DataSourceApiServerList{} },
	utils.TableColumns{}, // default table converter
)

var QueryTypeDefinitionResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"querytypes", "querytype", "QueryTypeDefinition",
	func() runtime.Object { return &QueryTypeDefinition{} },
	func() runtime.Object { return &QueryTypeDefinitionList{} },
	utils.TableColumns{}, // default table converter
)

var (
	// SchemeGroupVersion is group version used to register these objects
	SchemeGroupVersion = schema.GroupVersion{Group: GROUP, Version: VERSION}
)
