package v2alpha1

import (
	errors "errors"

	conversion "k8s.io/apimachinery/pkg/conversion"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
)

func Convert_v0alpha1_Unstructured_To_v2alpha1_DashboardSpec(in *common.Unstructured, out *DashboardSpec, s conversion.Scope) error {
	return errors.New("cannot convert v0alpha1.Unstructured to v2alpha1.DashboardSpec")
}

func Convert_v2alpha1_DashboardSpec_To_v0alpha1_Unstructured(in *DashboardSpec, out *common.Unstructured, s conversion.Scope) error {
	return errors.New("cannot convert v2alpha1.DashboardSpec to v0alpha1.Unstructured")
}
