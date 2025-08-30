package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

const (
	GROUP   = "*.datasource.grafana.app"
	VERSION = "v0alpha1"
)

var DataSourceResourceInfo = utils.NewResourceInfo(GROUP, VERSION,
	"datasources", "datasource", "DataSource",
	func() runtime.Object { return &DataSource{} },
	func() runtime.Object { return &DataSourceList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Title", Type: "string", Format: "string", Description: "Title"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]any, error) {
			m, ok := obj.(*DataSource)
			if !ok {
				return nil, fmt.Errorf("expected connection")
			}
			return []any{
				m.Name,
				m.Spec.Object["title"],
				m.CreationTimestamp.UTC().Format(time.RFC3339),
			}, nil
		},
	},
)
