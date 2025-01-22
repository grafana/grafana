package migration

import (
	"encoding/json"
	"maps"

	"github.com/grafana/grafana/pkg/apis/dashboard/migration/schemaversion"
)

// Unstructured is a type alias for a map[string]interface{}.
type Unstructured map[string]interface{}

func (u Unstructured) DeepCopy() Unstructured {
	clone := map[string]interface{}{}
	maps.Copy(clone, u)
	return clone
}

// +k8s:deepcopy-gen:interfaces=k8s.io/apimachinery/pkg/runtime.Object

// DashboardSpec is a specification for a migrated dashboard body.
// This is used by the kubernetes internal dashboard API version.
type DashboardSpec struct {
	Refresh       string `json:"refresh,omitempty"`
	SchemaVersion int    `json:"schemaVersion"`
	Title         string `json:"title"`

	unstructured Unstructured `json:"-"`
}

func (d *DashboardSpec) DeepCopy() *DashboardSpec {
	return &DashboardSpec{
		Refresh:       d.Refresh,
		SchemaVersion: d.SchemaVersion,
		Title:         d.Title,
		unstructured:  d.unstructured.DeepCopy(),
	}
}

func (d *DashboardSpec) DeepCopyInto(out *DashboardSpec) {
	out.Refresh = d.Refresh
	out.SchemaVersion = d.SchemaVersion
	out.Title = d.Title
	out.unstructured = d.unstructured.DeepCopy()
}

func (d *DashboardSpec) ToUnstructured() (Unstructured, error) {
	type ds DashboardSpec
	raw, err := json.Marshal((*ds)(d))
	if err != nil {
		return nil, err
	}

	tmpDash := map[string]interface{}{}
	maps.Copy(tmpDash, d.unstructured)
	err = json.Unmarshal(raw, &tmpDash)
	if err != nil {
		return nil, err
	}

	return tmpDash, nil
}

func (d *DashboardSpec) FromUnstructured(u Unstructured) error {
	d.unstructured = u

	dash := d.unstructured.DeepCopy()
	if err := Migrate(dash, schemaversion.LATEST_VERSION); err != nil {
		return err
	}

	migratedData, err := json.Marshal(dash)
	if err != nil {
		return err
	}

	type ds DashboardSpec
	if err := json.Unmarshal(migratedData, (*ds)(d)); err != nil {
		return err
	}

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
