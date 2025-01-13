package v2alpha1

import (
	conversion "k8s.io/apimachinery/pkg/conversion"
	klog "k8s.io/klog/v2"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func Convert_v0alpha1_Unstructured_To_v2alpha1_DashboardSpec(in *common.Unstructured, out *DashboardSpec, s conversion.Scope) error {
	out.Unstructured = *in

	t, ok := in.Object["title"]
	if !ok {
		return nil // skip setting the title if it's not in the unstructured object
	}

	title, ok := t.(string)
	if !ok {
		klog.V(5).Infof("unstructured dashboard title field is not a string %v", t)
		return nil // skip setting the title if it's not a string in the unstructured object
	}
	out.Title = title

	return nil
}

func Convert_v2alpha1_DashboardSpec_To_v0alpha1_Unstructured(in *DashboardSpec, out *common.Unstructured, s conversion.Scope) error {
	*out = in.Unstructured
	out.Object["title"] = in.Title
	return nil
}
