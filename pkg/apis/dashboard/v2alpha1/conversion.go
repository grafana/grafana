package v2alpha1

import (
	"errors"

	conversion "k8s.io/apimachinery/pkg/conversion"
	klog "k8s.io/klog/v2"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apis/dashboard/migration"
	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
)

func Convert_v0alpha1_Unstructured_To_v2alpha1_DashboardSpec(in *common.Unstructured, out *DashboardSpec, s conversion.Scope) error {
	out.Unstructured = *in
	err := migration.Migrate(out.Unstructured.Object, schemaversion.LATEST_VERSION)
	if err != nil {
		minErr := &schemaversion.MinimumVersionError{}
		if errors.As(err, &minErr) {
			out.Unstructured.Object["__migrationError"] = err.Error()
		} else {
			return err
		}
	}

	t, ok := out.Unstructured.Object["title"].(string)
	if !ok {
		klog.V(5).Infof("unstructured dashboard title field is not a string %v", t)
		return nil // skip setting the title if it's not a string in the unstructured object
	}
	out.Title = t
	return nil
}

func Convert_v2alpha1_DashboardSpec_To_v0alpha1_Unstructured(in *DashboardSpec, out *common.Unstructured, s conversion.Scope) error {
	*out = in.Unstructured
	out.Object["title"] = in.Title
	return nil
}
