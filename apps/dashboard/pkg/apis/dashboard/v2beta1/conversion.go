package v2beta1

import (
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (d *Dashboard) GetStoredVersion() string {
	if d.Status.Conversion != nil && d.Status.Conversion.StoredVersion != nil {
		return *d.Status.Conversion.StoredVersion
	}
	return ""
}

func (d *Dashboard) GetVersion() string {
	return VERSION
}

func (d *Dashboard) GetAPIVersion() string {
	return APIVERSION
}

func (d *Dashboard) SetConversionStatus(storedVersion string, failed bool, errMsg *string, source interface{}) {
	d.Status.Conversion = &DashboardConversionStatus{
		StoredVersion: new(storedVersion),
		Failed:        failed,
		Error:         errMsg,
		Source:        source,
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
	if d.Spec.Layout.GridLayoutKind == nil && d.Spec.Layout.RowsLayoutKind == nil {
		d.Spec.Layout = NewDashboardSpec().Layout
		d.Spec.Layout.GridLayoutKind = NewDashboardGridLayoutKind()
	}
}

// SetDecodedVersion implements apistore.DecodedVersionAware. It records the
// API version the codec just decoded onto status.conversion.storedVersion,
// preserving any existing failed/error/source fields.
func (d *Dashboard) SetDecodedVersion(version string) {
	if version == "" {
		return
	}
	if d.Status.Conversion == nil {
		d.Status.Conversion = &DashboardConversionStatus{}
	}
	d.Status.Conversion.StoredVersion = new(version)
}
