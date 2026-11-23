package pluginroute

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer/versioning"
)

type manifestSerializer struct {
	runtime.NegotiatedSerializer
	scheme *runtime.Scheme
}

func (s manifestSerializer) EncoderForVersion(encoder runtime.Encoder, target runtime.GroupVersioner) runtime.Encoder {
	if target == nil {
		return s.NegotiatedSerializer.EncoderForVersion(encoder, target)
	}
	converter := manifestListConverter{runtime.UnsafeObjectConvertor(s.scheme)}
	return versioning.NewCodec(encoder, nil, converter, s.scheme, s.scheme, s.scheme, target, nil, s.scheme.Name())
}

type manifestListConverter struct {
	runtime.ObjectConvertor
}

func (c manifestListConverter) ConvertToVersion(obj runtime.Object, target runtime.GroupVersioner) (runtime.Object, error) {
	list, ok := obj.(*unstructured.UnstructuredList)
	if !ok {
		return c.ObjectConvertor.ConvertToVersion(obj, target)
	}
	gvk := list.GroupVersionKind()
	converted, err := c.ObjectConvertor.ConvertToVersion(list, target)
	if err != nil {
		return nil, err
	}
	// All manifest lists share a Go type; the scheme can select the first registered kind.
	if expected, ok := target.KindForGroupVersionKinds([]schema.GroupVersionKind{gvk}); ok && expected == gvk {
		converted.GetObjectKind().SetGroupVersionKind(gvk)
	}
	return converted, nil
}
