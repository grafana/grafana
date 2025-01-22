package migration

import (
	"encoding/json"
	"maps"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
)

// Unstructured is a type alias for a map[string]interface{}.
// +k8s:openapi-gen=true
type Unstructured map[string]interface{}

func (u Unstructured) DeepCopy() Unstructured {
	clone := map[string]interface{}{}
	maps.Copy(clone, u)
	return clone
}

func (u Unstructured) DeepCopyInto(out *Unstructured) {
	{
		u := &u
		*out = u.DeepCopy()
		return
	}
}

// DashboardSpec is a specification for a migrated dashboard body.
// This is used by the kubernetes internal dashboard API version.
// +k8s:openapi-gen=true
type DashboardSpec struct {
	Refresh       string `json:"refresh,omitempty"`
	SchemaVersion int    `json:"schemaVersion"`
	Title         string `json:"title"`

	unstructured Unstructured `json:"-"`
}

func (d *DashboardSpec) DeepCopy() *DashboardSpec {
	clone := &DashboardSpec{}
	d.DeepCopyInto(clone)
	return clone
}

func (d *DashboardSpec) DeepCopyInto(out *DashboardSpec) {
	out.unstructured = d.unstructured.DeepCopy()

	out.Refresh = d.Refresh
	delete(out.unstructured, "refresh")

	out.SchemaVersion = d.SchemaVersion
	delete(out.unstructured, "schemaVersion")

	out.Title = d.Title
	delete(out.unstructured, "title")
}

func (d *DashboardSpec) ToUnstructured() (Unstructured, error) {
	tmpDash := map[string]interface{}{}
	maps.Copy(tmpDash, d.unstructured)

	tmpDash["refresh"] = d.Refresh
	tmpDash["schemaVersion"] = d.SchemaVersion
	tmpDash["title"] = d.Title

	return tmpDash, nil
}

func (d *DashboardSpec) FromUnstructured(u Unstructured) error {
	type ds DashboardSpec
	tmpDash := &ds{}
	tmpDash.unstructured = u
	if err := Migrate(tmpDash.unstructured, schemaversion.LATEST_VERSION); err != nil {
		return err
	}

	migratedData, err := json.Marshal(tmpDash.unstructured)
	if err != nil {
		return err
	}

	if err := json.Unmarshal(migratedData, tmpDash); err != nil {
		return err
	}

	(*DashboardSpec)(tmpDash).DeepCopyInto(d)
	return err
}

func (d *DashboardSpec) UnmarshalJSON(data []byte) error {
	dash := Unstructured{}
	if err := json.Unmarshal(data, &dash); err != nil {
		return err
	}
	return d.FromUnstructured(dash)
}

func (d *DashboardSpec) MarshalJSON() ([]byte, error) {
	tmpDash, err := d.ToUnstructured()
	if err != nil {
		return nil, err
	}
	return json.Marshal(tmpDash)
}
