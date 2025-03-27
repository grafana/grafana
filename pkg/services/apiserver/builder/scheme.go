package builder

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
)

func ProvideScheme() *runtime.Scheme {
	unversionedVersion := schema.GroupVersion{Group: "", Version: "v1"}
	unversionedTypes := []runtime.Object{
		&metav1.Status{},
		&metav1.WatchEvent{},
		&metav1.APIVersions{},
		&metav1.APIGroupList{},
		&metav1.APIGroup{},
		&metav1.APIResourceList{},
		&metav1.PartialObjectMetadata{},
		&metav1.PartialObjectMetadataList{},
	}

	scheme := runtime.NewScheme()
	// we need to add the options to empty v1
	metav1.AddToGroupVersion(scheme, schema.GroupVersion{Group: "", Version: "v1"})
	scheme.AddUnversionedTypes(unversionedVersion, unversionedTypes...)
	return scheme
}

func ProvideCodecFactory(scheme *runtime.Scheme) serializer.CodecFactory {
	return serializer.NewCodecFactory(scheme)
}
