package apiserver

import (
	"fmt"

	"github.com/grafana/grafana/pkg/services/store/entity"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

func objectToWriteCommand(orgID int64, obj runtime.Object, options *metav1.CreateOptions) (*entity.WriteEntityRequest, error) {
	uObj, ok := obj.(*unstructured.Unstructured)
	if !ok {
		return nil, fmt.Errorf("failed to convert to *unstructured.Unstructured")
	}
	var err error

	req := &entity.WriteEntityRequest{
		GRN: &entity.GRN{
			TenantId: orgID, // from the user
			Kind:     uObj.GetObjectKind().GroupVersionKind().Kind,
			UID:      uObj.GetName(),
		},
	}

	req.Body, err = uObj.MarshalJSON()

	return req, err
}
