package timeinterval

import (
	"encoding/json"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/resource/timeinterval/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

func ConvertToK8sResources(orgID int64, intervals []definitions.MuteTimeInterval, namespacer request.NamespaceMapper, selector fields.Selector) (*model.TimeIntervalList, error) {
	data, err := json.Marshal(intervals)
	if err != nil {
		return nil, err
	}
	var specs []model.Spec
	err = json.Unmarshal(data, &specs)
	if err != nil {
		return nil, err
	}
	result := &model.TimeIntervalList{}

	for idx := range specs {
		interval := intervals[idx]
		spec := specs[idx]
		item := buildTimeInterval(orgID, interval, spec, namespacer)
		if selector != nil && !selector.Empty() && !selector.Matches(model.SelectableFields(&item)) {
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
	spec := model.Spec{}
	err = json.Unmarshal(data, &spec)
	if err != nil {
		return nil, err
	}
	result := buildTimeInterval(orgID, interval, spec, namespacer)
	result.UID = gapiutil.CalculateClusterWideUID(&result)
	return &result, nil
}

func buildTimeInterval(orgID int64, interval definitions.MuteTimeInterval, spec model.Spec, namespacer request.NamespaceMapper) model.TimeInterval {
	i := model.TimeInterval{
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
	result.Provenance = definitions.Provenance(ngmodels.ProvenanceNone)
	err = result.Validate()
	if err != nil {
		return definitions.MuteTimeInterval{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}
	return result, nil
}
