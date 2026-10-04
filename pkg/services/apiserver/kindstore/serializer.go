package kindstore

import (
	"context"
	"encoding/json"
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/util/uuid"
	"k8s.io/apiserver/pkg/warning"

	appclientv3 "github.com/grafana/grafana-app-sdk/plugin/client/v3"
	pluginv3 "github.com/grafana/grafana-app-sdk/plugin/genproto/grafana/plugin/v3"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

type conversionSerializer struct {
	apistore.Serializer

	// Target
	gvk schema.GroupVersionKind

	// The callback
	client appclientv3.ConversionClient
}

func (s *conversionSerializer) Decode(ctx context.Context, data []byte, into runtime.Object) (runtime.Object, error) {
	var meta metav1.TypeMeta
	if err := json.Unmarshal(data, &meta); err != nil {
		return nil, err
	}
	source := meta.GroupVersionKind()
	if source == s.gvk {
		return s.Serializer.Decode(ctx, data, into)
	}

	gvk := &pluginv3.GroupVersionKind{}
	gvk.SetGroup(source.Group)
	gvk.SetVersion(source.Version)
	gvk.SetKind(source.Kind)
	obj := &pluginv3.ConvertObjectsRequest_Object{}
	obj.SetGvk(gvk)
	obj.SetRaw(data)
	api := &pluginv3.GroupVersion{}
	api.SetGroup(s.gvk.Group)
	api.SetVersion(s.gvk.Version)
	req := &pluginv3.ConvertObjectsRequest{}
	req.SetApi(api)
	req.SetUid(string(uuid.NewUUID()))
	req.SetObjects([]*pluginv3.ConvertObjectsRequest_Object{obj})
	req.SetTargetVersion(s.gvk.Version)
	rsp, err := s.client.ConvertObjects(ctx, req)
	if err != nil {
		return nil, fmt.Errorf("conversion to %s failed: %w", s.gvk, err)
	}
	if status := rsp.GetError(); status != nil {
		return nil, fmt.Errorf("conversion to %s failed: %s", s.gvk, status.GetMessage())
	}
	converted := rsp.GetConverted()
	if len(converted) != 1 {
		return nil, fmt.Errorf("conversion to %s returned %d objects, expected 1", s.gvk, len(converted))
	}
	for _, w := range converted[0].GetWarnings() {
		warning.AddWarning(ctx, "", w)
	}
	return s.Serializer.Decode(ctx, converted[0].GetRaw(), into)
}
