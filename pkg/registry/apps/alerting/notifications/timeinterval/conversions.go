package timeinterval

import (
	"encoding/json"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

func ConvertToK8sResources(orgID int64, intervals []definitions.MuteTimeInterval, managerProps map[string]utils.ManagerProperties, namespacer request.NamespaceMapper, selector fields.Selector) (*model.TimeIntervalList, error) {
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
		item := buildTimeInterval(orgID, interval, spec, managerProps[interval.Name], namespacer)
		if selector != nil && !selector.Empty() && !selector.Matches(model.TimeIntervalSelectableFields(&item)) {
			continue
		}
		result.Items = append(result.Items, item)
	}
	return result, nil
}

func ConvertToK8sResource(orgID int64, interval definitions.MuteTimeInterval, manager utils.ManagerProperties, namespacer request.NamespaceMapper) (*model.TimeInterval, error) {
	data, err := json.Marshal(interval)
	if err != nil {
		return nil, err
	}
	spec := model.TimeIntervalSpec{}
	err = json.Unmarshal(data, &spec)
	if err != nil {
		return nil, err
	}
	result := buildTimeInterval(orgID, interval, spec, manager, namespacer)
	result.UID = gapiutil.CalculateClusterWideUID(&result)
	return &result, nil
}

func buildTimeInterval(orgID int64, interval definitions.MuteTimeInterval, spec model.TimeIntervalSpec, manager utils.ManagerProperties, namespacer request.NamespaceMapper) model.TimeInterval {
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

	// Surface the richer ManagerProperties when present, falling back to deriving them from
	// provenance so resources without a stored manager (incl. imported ones) are still labelled.
	if manager.Kind == utils.ManagerKindUnknown {
		manager = ngmodels.ProvenanceToManagerProperties(ngmodels.Provenance(interval.Provenance))
	}
	if manager.Kind != utils.ManagerKindUnknown {
		if meta, err := utils.MetaAccessor(&i); err == nil {
			meta.SetManagerProperties(manager)
		}
	}

	i.UID = gapiutil.CalculateClusterWideUID(&i)

	i.SetCanUse(ngmodels.Provenance(interval.Provenance) != ngmodels.ProvenanceConvertedPrometheus)

	return i
}

func convertToDomainModel(interval *model.TimeInterval) (definitions.MuteTimeInterval, utils.ManagerProperties, error) {
	b, err := json.Marshal(interval.Spec)
	if err != nil {
		return definitions.MuteTimeInterval{}, utils.ManagerProperties{}, err
	}
	result := definitions.MuteTimeInterval{}
	err = json.Unmarshal(b, &result)
	if err != nil {
		return definitions.MuteTimeInterval{}, utils.ManagerProperties{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}
	result.Version = interval.ResourceVersion
	result.UID = interval.Name

	prov, err := ngmodels.ProvenanceFromString(interval.GetProvenanceStatus())
	if err != nil {
		return definitions.MuteTimeInterval{}, utils.ManagerProperties{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}
	result.Provenance = definitions.Provenance(prov)

	// Prefer explicit ManagerProperties annotations (set by app-platform tooling) over the
	// coarser provenance annotation, so a richer manager kind/identity survives the write.
	var manager utils.ManagerProperties
	if meta, err := utils.MetaAccessor(interval); err == nil {
		if mp, ok := meta.GetManagerProperties(); ok {
			manager = mp
		}
	}

	err = result.Validate()
	if err != nil {
		return definitions.MuteTimeInterval{}, utils.ManagerProperties{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}
	return result, manager, nil
}
