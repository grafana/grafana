package time_intervals

import (
	"encoding/json"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	notifications "github.com/grafana/grafana/pkg/apis/alerting/notifications/v0alpha1"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

func convertToK8sResources(orgID int64, intervals []definitions.MuteTimeInterval, namespacer request.NamespaceMapper) (*notifications.TimeIntervalList, error) {
	data, err := json.Marshal(intervals)
	if err != nil {
		return nil, err
	}
	var specs []notifications.TimeIntervalSpec
	err = json.Unmarshal(data, &specs)
	if err != nil {
		return nil, err
	}
	result := &notifications.TimeIntervalList{}
	for idx := range specs {
		interval := intervals[idx]
		spec := specs[idx]
		result.Items = append(result.Items, notifications.TimeInterval{
			TypeMeta: resourceInfo.TypeMeta(),
			ObjectMeta: metav1.ObjectMeta{
				Name:      interval.Name,
				Namespace: namespacer(orgID),
				Annotations: map[string]string{ // TODO find a better place for provenance?
					"grafana.com/provenance": string(interval.Provenance),
				},
				// TODO ResourceVersion and CreationTimestamp
			},
			Spec: spec,
		})
	}
	return result, nil
}

func convertToK8sResource(orgID int64, interval definitions.MuteTimeInterval, namespacer request.NamespaceMapper) (*notifications.TimeInterval, error) {
	data, err := json.Marshal(interval)
	if err != nil {
		return nil, err
	}
	spec := notifications.TimeIntervalSpec{}
	err = json.Unmarshal(data, &spec)
	if err != nil {
		return nil, err
	}

	return &notifications.TimeInterval{
		TypeMeta: resourceInfo.TypeMeta(),
		ObjectMeta: metav1.ObjectMeta{
			Name:      interval.Name,
			Namespace: namespacer(orgID),
			Annotations: map[string]string{ // TODO find a better place for provenance?
				"grafana.com/provenance": string(interval.Provenance),
			},
		},
		Spec: spec,
	}, nil
}

func convertToDomainModel(interval *notifications.TimeInterval) (definitions.MuteTimeInterval, error) {
	b, err := json.Marshal(interval.Spec)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	result := definitions.MuteTimeInterval{}
	err = json.Unmarshal(b, &result)
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	result.Name = interval.Name
	err = result.Validate()
	if err != nil {
		return definitions.MuteTimeInterval{}, err
	}
	return result, nil
}
