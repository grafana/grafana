package v2alpha1

import "k8s.io/utils/ptr"

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
