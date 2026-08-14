package app

import (
	"bytes"
	"errors"
	"fmt"
	"strconv"

	"github.com/grafana/grafana-app-sdk/k8s"
	"github.com/grafana/grafana-app-sdk/resource"
	"github.com/grafana/grafana-app-sdk/simple"
	"github.com/grafana/grafana/apps/example/pkg/apis/example/v0alpha1"
	"github.com/grafana/grafana/apps/example/pkg/apis/example/v1alpha1"
	"k8s.io/apimachinery/pkg/runtime/schema"
)

var _ simple.Converter = NewExampleConverter()

type ExampleConverter struct{}

func NewExampleConverter() *ExampleConverter {
	return &ExampleConverter{}
}

// Convert converts an object from an arbitrary input version slice of bytes
// to a target version, and returns the JSON bytes of that version.
func (e *ExampleConverter) Convert(obj k8s.RawKind, targetAPIVersion string) ([]byte, error) {
	srcGVK := schema.FromAPIVersionAndKind(obj.APIVersion, obj.Kind)
	dstGVK := schema.FromAPIVersionAndKind(targetAPIVersion, v1alpha1.ExampleKind().Kind())
	if srcGVK.Group != v1alpha1.APIGroup {
		// This should never happen, but check just in case
		return nil, fmt.Errorf("wrong group to convert example.grafana.app, got %s", srcGVK.Group)
	}
	if srcGVK.Kind != v1alpha1.ExampleKind().Kind() {
		// This should also never happen, but check just in case
		return nil, fmt.Errorf("wrong kind to convert Example, got %s", srcGVK.Kind)
	}
	if srcGVK == dstGVK {
		// This should never happen, but if it does no conversion is necessary, we can return the input
		return obj.Raw, nil
	}

	// Check source version
	switch srcGVK.Version {
	case v0alpha1.APIVersion:
		srcKind := v0alpha1.ExampleKind()
		uncastSrcObj, err := srcKind.Read(bytes.NewReader(obj.Raw), resource.KindEncodingJSON)
		if err != nil {
			return nil, fmt.Errorf("unable to parse JSON bytes into %s: %w", srcGVK.String(), err)
		}
		srcObj, ok := uncastSrcObj.(*v0alpha1.Example)
		if !ok {
			return nil, errors.New("read object was not of type *v0alpha1.Example")
		}
		switch dstGVK.Version {
		case v1alpha1.APIVersion:
			dstObj := &v1alpha1.Example{}
			// Set Type metadata
			dstObj.SetGroupVersionKind(dstGVK)
			// Copy Object metadata
			srcObj.ObjectMeta.DeepCopyInto(&dstObj.ObjectMeta)
			// Copy spec and status
			dstObj.Spec.FirstField = strconv.Itoa(int(srcObj.Spec.FirstField))
			dstObj.Status.LastObservedGeneration = srcObj.Status.LastObservedGeneration
			dstObj.Status.AdditionalFields = srcObj.Status.AdditionalFields
			if srcObj.Status.OperatorStates != nil {
				dstObj.Status.OperatorStates = make(map[string]v1alpha1.ExamplestatusOperatorState)
				for k, v := range srcObj.Status.OperatorStates {
					dstObj.Status.OperatorStates[k] = v1alpha1.ExamplestatusOperatorState{
						LastEvaluation:   v.LastEvaluation,
						State:            v1alpha1.ExampleStatusOperatorStateState(v.State),
						DescriptiveState: v.DescriptiveState,
						Details:          v.Details,
					}
				}
			}
			dstKind := v1alpha1.ExampleKind()
			buf := &bytes.Buffer{}
			err := dstKind.Write(dstObj, buf, resource.KindEncodingJSON)
			return buf.Bytes(), err
		default:
			return nil, fmt.Errorf("unknown target version %s", dstGVK.Version)
		}
	case v1alpha1.APIVersion:
		srcKind := v1alpha1.ExampleKind()
		uncastSrcObj, err := srcKind.Read(bytes.NewReader(obj.Raw), resource.KindEncodingJSON)
		if err != nil {
			return nil, fmt.Errorf("unable to parse JSON bytes into %s: %w", srcGVK.String(), err)
		}
		srcObj, ok := uncastSrcObj.(*v1alpha1.Example)
		if !ok {
			return nil, errors.New("read object was not of type *v1alpha1.Example")
		}
		switch dstGVK.Version {
		case v0alpha1.APIVersion:
			dstObj := &v0alpha1.Example{}
			// Set Type metadata
			dstObj.SetGroupVersionKind(dstGVK)
			// Copy Object metadata
			srcObj.ObjectMeta.DeepCopyInto(&dstObj.ObjectMeta)
			// Copy spec and status
			castInt, _ := strconv.Atoi(srcObj.Spec.FirstField) // Lossy backwards conversion
			dstObj.Spec.FirstField = int64(castInt)
			dstObj.Status.LastObservedGeneration = srcObj.Status.LastObservedGeneration
			dstObj.Status.AdditionalFields = srcObj.Status.AdditionalFields
			if srcObj.Status.OperatorStates != nil {
				dstObj.Status.OperatorStates = make(map[string]v0alpha1.ExamplestatusOperatorState)
				for k, v := range srcObj.Status.OperatorStates {
					dstObj.Status.OperatorStates[k] = v0alpha1.ExamplestatusOperatorState{
						LastEvaluation:   v.LastEvaluation,
						State:            v0alpha1.ExampleStatusOperatorStateState(v.State),
						DescriptiveState: v.DescriptiveState,
						Details:          v.Details,
					}
				}
			}
			dstKind := v0alpha1.ExampleKind()
			buf := &bytes.Buffer{}
			err := dstKind.Write(dstObj, buf, resource.KindEncodingJSON)
			return buf.Bytes(), err
		default:
			return nil, fmt.Errorf("unknown target version %s", dstGVK.Version)
		}
	}
	return nil, fmt.Errorf("unknown source version %s", srcGVK.Version)
}
