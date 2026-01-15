package builder

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	/* "k8s.io/apimachinery/pkg/runtime/serializer/cbor"
	"k8s.io/apiserver/pkg/features"
	utilfeature "k8s.io/apiserver/pkg/util/feature" */)

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

// the codecs are anyway replaced by
// https://github.com/kubernetes/kubernetes/blob/f4f3e5f92c38d8f3005996201bd2cdccd16629bc/staging/src/k8s.io/apiserver/pkg/server/genericapiserver.go#L1009-L1021
// since we build NegotiatedSerializer after NewDefaultAPIGroupInfo, the following helper captures the lost gates to reapply in our override
func ProvideCodecFactory(scheme *runtime.Scheme) serializer.CodecFactory {
	codecs := serializer.NewCodecFactory(scheme)

	/* opts := []serializer.CodecFactoryOptionsMutator{}
	if utilfeature.DefaultFeatureGate.Enabled(features.CBORServingAndStorage) {
		opts = append(opts, serializer.WithSerializer(cbor.NewSerializerInfo))
	}
	if utilfeature.DefaultFeatureGate.Enabled(features.StreamingCollectionEncodingToJSON) {
		opts = append(opts, serializer.WithStreamingCollectionEncodingToJSON())
	}
	if utilfeature.DefaultFeatureGate.Enabled(features.StreamingCollectionEncodingToProtobuf) {
		opts = append(opts, serializer.WithStreamingCollectionEncodingToProtobuf())
	}
	if len(opts) != 0 {
		codecs = serializer.NewCodecFactory(scheme, opts...)
	} */
	return codecs
}
