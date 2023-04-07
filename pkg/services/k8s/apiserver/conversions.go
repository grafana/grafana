package apiserver

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/grafana/grafana/pkg/services/store/entity"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
)

func objectToWriteCommand(orgID int64, obj runtime.Object) (*entity.WriteEntityRequest, error) {
	raw, err := runtime.DefaultUnstructuredConverter.ToUnstructured(obj)
	if err != nil {
		return nil, err
	}
	uObj := unstructured.Unstructured{}
	uObj.SetUnstructuredContent(raw)

	// Convert from CRD names to entity api names
	// HACK for now
	kind := strings.ToLower(uObj.GetKind())

	req := &entity.WriteEntityRequest{
		GRN: &entity.GRN{
			TenantId: orgID, // from the user
			Kind:     kind,
			UID:      uObj.GetName(),
		},
	}

	rv := uObj.GetResourceVersion()
	if rv != "" {
		// req.PreviousVersion, err = strconv.ParseUint(rv, 10, 64)
		// if err != nil {
		// 	return nil, fmt.Errorf("unable to parse resource version")
		// }
		fmt.Printf("TODO: %s\n", rv)
	}

	v, ok := raw["spec"]
	if ok {
		req.Body, err = json.Marshal(v)
		if err != nil {
			return nil, fmt.Errorf("unable to read spec")
		}
	}

	v, ok = raw["status"]
	if ok {
		req.Status, err = json.Marshal(v)
		if err != nil {
			return nil, fmt.Errorf("unable to read spec")
		}
	}
	return req, err
}

func searchResultToK8s(obj *unstructured.Unstructured, res *entity.EntitySearchResult) *unstructured.Unstructured {
	obj.SetNamespace("default")
	obj.SetResourceVersion(formatResourceVersion(res.Version))
	obj.SetName(res.GRN.UID)

	// Missing GUID.... and meta....

	if res.Body != nil {
		var spec map[string]interface{}
		_ = json.Unmarshal(res.Body, &spec)
		obj.Object["spec"] = spec
	}

	return obj
}
