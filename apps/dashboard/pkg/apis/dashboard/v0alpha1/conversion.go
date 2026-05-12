package v0alpha1

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
	// v0alpha1 doesn't require default spec setup
}

// SetDecodedVersion implements apistore.DecodedVersionAware. It records the
// API version the codec just decoded onto status.conversion.storedVersion,
// preserving any existing failed/error/source fields. This is the
// authoritative ground truth at the storage boundary: the decoded GVK is
// the on-disk version, so it overwrites any stale value that may have been
// encoded into the stored bytes.
func (d *Dashboard) SetDecodedVersion(version string) {
	if version == "" {
		return
	}
	if d.Status.Conversion == nil {
		d.Status.Conversion = &DashboardConversionStatus{}
	}
	d.Status.Conversion.StoredVersion = new(version)
}
