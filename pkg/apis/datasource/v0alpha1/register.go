package v0alpha1

import (
	"fmt"
	"time"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
)

const (
	GROUP   = "*.datasource.grafana.app"
	VERSION = "v0alpha1"
)

var GenericConnectionResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
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
