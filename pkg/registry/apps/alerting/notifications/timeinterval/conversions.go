package timeinterval

import (
	"encoding/json"
	"fmt"
	"slices"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

// provenanceFromAnnotation maps the grafana.com/provenance annotation value
// from a k8s API request to a Provenance for use in the service layer.
//
// Provenance is opt-in for the k8s API: callers must explicitly set
// grafana.com/provenance: api to mark a resource as externally managed.
// If the annotation is absent or "none", ProvenanceNone is returned and the
// resource remains freely editable by all callers (including the Grafana UI).
//
// Contrast with the HTTP provisioning API (/api/v1/provisioning/...) which is
// opt-out: it sets ProvenanceAPI on every write unless the caller sends the
// X-Disable-Provenance header.
func provenanceFromAnnotation(annotationVal string) (definitions.Provenance, error) {
	// ngmodels.ProvenanceNone is an empty string so explicitly check for "none" as well
	if annotationVal != model.ProvenanceStatusNone && !slices.Contains(ngmodels.KnownProvenances, ngmodels.Provenance(annotationVal)) {
		return definitions.Provenance(""), fmt.Errorf("invalid provenance status: %s", annotationVal)
	}

	if annotationVal == "" || annotationVal == model.ProvenanceStatusNone {
		return definitions.Provenance(ngmodels.ProvenanceNone), nil
	}
	return definitions.Provenance(annotationVal), nil
}

func ConvertToK8sResources(orgID int64, intervals []definitions.MuteTimeInterval, namespacer request.NamespaceMapper, selector fields.Selector) (*model.TimeIntervalList, error) {
	data, err := json.Marshal(intervals)
	if err != nil {
		return nil, err
	}
	var specs []model.TimeIntervalSpec
	err = json.Unmarshal(data, &specs)
	if err != nil {
		return nil, err
	}
	result := &model.TimeIntervalList{}

	for idx := range specs {
		interval := intervals[idx]
		spec := specs[idx]
		item := buildTimeInterval(orgID, interval, spec, namespacer)
		if selector != nil && !selector.Empty() && !selector.Matches(model.TimeIntervalSelectableFields(&item)) {
			continue
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

func ConvertToK8sResource(orgID int64, interval definitions.MuteTimeInterval, namespacer request.NamespaceMapper) (*model.TimeInterval, error) {
	data, err := json.Marshal(interval)
	if err != nil {
		return nil, err
	}
	spec := model.TimeIntervalSpec{}
	err = json.Unmarshal(data, &spec)
	if err != nil {
		return nil, err
	}
	result := buildTimeInterval(orgID, interval, spec, namespacer)
	result.UID = gapiutil.CalculateClusterWideUID(&result)
	return &result, nil
}

func buildTimeInterval(orgID int64, interval definitions.MuteTimeInterval, spec model.TimeIntervalSpec, namespacer request.NamespaceMapper) model.TimeInterval {
	i := model.TimeInterval{
		TypeMeta: metav1.TypeMeta{
			APIVersion: kind.GroupVersionKind().GroupVersion().String(),
			Kind:       kind.Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(interval.UID), // TODO This is needed to make PATCH work
			Name:            interval.UID,            // TODO replace to stable UID when we switch to normal storage
			Namespace:       namespacer(orgID),
			ResourceVersion: interval.Version,
		},
		Spec: spec,
	}
	i.SetProvenanceStatus(string(interval.Provenance))
	i.UID = gapiutil.CalculateClusterWideUID(&i)

	i.SetCanUse(ngmodels.Provenance(interval.Provenance) != ngmodels.ProvenanceConvertedPrometheus)

	return i
}

func convertToDomainModel(interval *model.TimeInterval) (definitions.MuteTimeInterval, error) {
	b, err := json.Marshal(interval.Spec)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	result := definitions.MuteTimeInterval{}
	err = json.Unmarshal(b, &result)
	if err != nil {
		return definitions.MuteTimeInterval{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}
	result.Version = interval.ResourceVersion
	result.UID = interval.Name
	result.Provenance, err = provenanceFromAnnotation(interval.GetProvenanceStatus())
	if err != nil {
		return definitions.MuteTimeInterval{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}
	err = result.Validate()
	if err != nil {
		return definitions.MuteTimeInterval{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}
	return result, nil
}
