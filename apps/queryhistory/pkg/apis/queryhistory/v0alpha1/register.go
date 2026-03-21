package v0alpha1

import (
	"fmt"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
)

var QueryHistoryResourceInfo = utils.NewResourceInfo(APIGroup, APIVersion,
	"queryhistories", "queryhistory", "QueryHistory",
	func() runtime.Object { return &QueryHistory{} },
	func() runtime.Object { return &QueryHistoryList{} },
	utils.TableColumns{
		Definition: []metav1.TableColumnDefinition{
			{Name: "Name", Type: "string", Format: "name"},
			{Name: "Created At", Type: "date"},
		},
		Reader: func(obj any) ([]any, error) {
			m, ok := obj.(*QueryHistory)
			if ok && m != nil {
				return []any{
					m.Name,
					m.CreationTimestamp.UTC().Format(time.RFC3339),
				}, nil
			}
			return nil, fmt.Errorf("expected QueryHistory")
		},
	},
)

var (
	SchemeBuilder      runtime.SchemeBuilder
	localSchemeBuilder = &SchemeBuilder
	AddToScheme        = localSchemeBuilder.AddToScheme
	schemeGroupVersion = GroupVersion
)

func init() {
	localSchemeBuilder.Register(addKnownTypes, addDefaultingFuncs)
}

func addKnownTypes(scheme *runtime.Scheme) error {
	scheme.AddKnownTypes(schemeGroupVersion,
		&QueryHistory{},
		&QueryHistoryList{},
	)
	metav1.AddToGroupVersion(scheme, schemeGroupVersion)
	return nil
}

func addDefaultingFuncs(scheme *runtime.Scheme) error {
	return nil
}
