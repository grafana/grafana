package timeinterval

import (
	"encoding/json"

	"github.com/prometheus/alertmanager/timeinterval"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

func ConvertToK8sResources(orgID int64, intervals []v1.TimeInterval, namespacer request.NamespaceMapper, selector fields.Selector) (*model.TimeIntervalList, error) {
	result := &model.TimeIntervalList{}

	for _, interval := range intervals {
		item, err := ConvertToK8sResource(orgID, interval, namespacer)
		if err != nil {
			return nil, err
		}

		if selector != nil && !selector.Empty() && !selector.Matches(model.TimeIntervalSelectableFields(item)) {
			continue
		}
		result.Items = append(result.Items, *item)
	}
	return result, nil
}

func ConvertToK8sResource(orgID int64, interval v1.TimeInterval, namespacer request.NamespaceMapper) (*model.TimeInterval, error) {
	timeIntervals, err := convertToSpec(interval.TimeIntervals)
	if err != nil {
		return nil, err
	}
	spec := model.TimeIntervalSpec{
		Name:          interval.Title,
		TimeIntervals: timeIntervals,
	}
	result := buildTimeInterval(orgID, interval, spec, namespacer)
	return &result, nil
}

// convertToSpec converts the domain time intervals into the generated API types.
// The JSON representation of timeinterval.TimeInterval matches model.TimeIntervalInterval,
// so we round-trip through JSON instead of mapping each field by hand.
func convertToSpec(intervals []timeinterval.TimeInterval) ([]model.TimeIntervalInterval, error) {
	data, err := json.Marshal(intervals)
	if err != nil {
		return nil, err
	}
	var result []model.TimeIntervalInterval
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}

func buildTimeInterval(orgID int64, interval v1.TimeInterval, spec model.TimeIntervalSpec, namespacer request.NamespaceMapper) model.TimeInterval {
	i := model.TimeInterval{
		TypeMeta: metav1.TypeMeta{
			APIVersion: kind.GroupVersionKind().GroupVersion().String(),
			Kind:       kind.Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(interval.UID), // TODO This is needed to make PATCH work
			Name:            string(interval.UID),
			Namespace:       namespacer(orgID),
			ResourceVersion: interval.Version,
		},
		Spec: spec,
	}
	i.SetProvenanceStatus(string(interval.Provenance))
	i.UID = gapiutil.CalculateClusterWideUID(&i)

	i.SetCanUse(interval.Provenance != ngmodels.ProvenanceConvertedPrometheus)

	return i
}

func convertToDomainModel(interval *model.TimeInterval) (v1.TimeInterval, error) {
	timeIntervals, err := convertFromSpec(interval.Spec.TimeIntervals)
	if err != nil {
		return v1.TimeInterval{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}

	prov, err := ngmodels.ProvenanceFromString(interval.GetProvenanceStatus())
	if err != nil {
		return v1.TimeInterval{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}

	return v1.TimeInterval{
		ResourceMetadata: v1.ResourceMetadata{
			UID:        v1.ResourceUID(interval.Name),
			Version:    interval.ResourceVersion,
			Provenance: prov,
		},
		Title:         interval.Spec.Name,
		TimeIntervals: timeIntervals,
	}, nil
}

// convertFromSpec is the inverse of convertToSpec, converting the generated API types
// back into the domain time intervals via JSON round-trip.
func convertFromSpec(intervals []model.TimeIntervalInterval) ([]timeinterval.TimeInterval, error) {
	data, err := json.Marshal(intervals)
	if err != nil {
		return nil, err
	}
	var result []timeinterval.TimeInterval
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, err
	}
	return result, nil
}
