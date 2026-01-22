package v0alpha1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"
)

func (d *Dashboard) GetStoredVersion() string {
	if d.Status.Conversion != nil && d.Status.Conversion.StoredVersion != nil {
		return *d.Status.Conversion.StoredVersion
	}
	return ""
}

func (d *Dashboard) GetAPIVersion() string {
	return VERSION
}

func (d *Dashboard) SetConversionStatus(storedVersion string, failed bool, errMsg *string, source interface{}) {
	d.Status = DashboardStatus{
		Conversion: &DashboardConversionStatus{
			StoredVersion: ptr.To(storedVersion),
			Failed:        failed,
			Error:         errMsg,
			Source:        source,
		},
	}
}

func (d *Dashboard) GetObjectMeta() interface{} {
	return d.ObjectMeta
}

func (d *Dashboard) SetObjectMeta(meta interface{}) {
	d.ObjectMeta = meta.(metav1.ObjectMeta)
}

func (d *Dashboard) GetKind() string {
	return d.Kind
}

func (d *Dashboard) SetKind(kind string) {
	d.Kind = kind
}

func (d *Dashboard) SetAPIVersion(version string) {
	d.APIVersion = version
}

func (d *Dashboard) EnsureDefaultSpec() {
	// v0alpha1 doesn't require default spec setup
}
