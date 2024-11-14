package v1alpha1

import (
	conversion "k8s.io/apimachinery/pkg/conversion"
	klog "k8s.io/klog/v2"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func Convert_v0alpha1_Unstructured_To_v1alpha1_DashboardSpec(in *common.Unstructured, out *DashboardSpec, s conversion.Scope) error {
	out.Unstructured = *in

	t := in.Object["title"]
	title, ok := t.(string)
	if !ok {
		klog.V(5).Infof("dashboard v2alpha1 title field is not a string %s", t)
		// do not force the title field
		return nil
	}
	out.Title = title

	return nil
}

func Convert_v1alpha1_DashboardSpec_To_v0alpha1_Unstructured(in *DashboardSpec, out *common.Unstructured, s conversion.Scope) error {
	*out = in.Unstructured
	out.Object["title"] = in.Title
	return nil
}
