package timeinterval

import (
	"encoding/json"
	"fmt"

	"github.com/prometheus/alertmanager/timeinterval"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

func ConvertToK8sResources(orgID int64, intervals []v1.TimeInterval, managerPropsMap map[string]utils.ManagerProperties, namespacer request.NamespaceMapper, selector fields.Selector) (*model.TimeIntervalList, error) {
	result := &model.TimeIntervalList{}

	for _, interval := range intervals {
		item, err := ConvertToK8sResource(orgID, interval, managerPropsMap[string(interval.UID)], namespacer)
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

func ConvertToK8sResource(orgID int64, interval v1.TimeInterval, managerProps utils.ManagerProperties, namespacer request.NamespaceMapper) (*model.TimeInterval, error) {
	timeIntervals, err := convertToSpec(interval.TimeIntervals)
	if err != nil {
		return nil, err
	}
	spec := model.TimeIntervalSpec{
		Name:          interval.Title,
		TimeIntervals: timeIntervals,
	}
	result := buildTimeInterval(orgID, interval, managerProps, spec, namespacer)
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

func buildTimeInterval(orgID int64, interval v1.TimeInterval, managerProps utils.ManagerProperties, spec model.TimeIntervalSpec, namespacer request.NamespaceMapper) model.TimeInterval {
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
	// Prefer the richer manager-derived provenance; fall back to whatever provenance the
	// caller already resolved (e.g. a special sentinel with no manager-kind equivalent).
	provenance := interval.Provenance
	if managerProps.Kind != utils.ManagerKindUnknown {
		provenance = ngmodels.ManagerPropertiesToProvenance(managerProps)
	}
	i.SetProvenanceStatus(string(provenance))
	i.UID = gapiutil.CalculateClusterWideUID(&i)

	i.SetCanUse(provenance != ngmodels.ProvenanceConvertedPrometheus)

	if managerProps.Kind != utils.ManagerKindUnknown {
		if meta, err := utils.MetaAccessor(&i); err == nil {
			meta.SetManagerProperties(managerProps)
		}
	}

	return i
}

func convertToDomainModel(interval *model.TimeInterval) (v1.TimeInterval, utils.ManagerProperties, error) {
	timeIntervals, err := convertFromSpec(interval.Spec.TimeIntervals)
	if err != nil {
		return v1.TimeInterval{}, utils.ManagerProperties{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}

	managerProps, prov, err := extractManagerProperties(interval)
	if err != nil {
		return v1.TimeInterval{}, utils.ManagerProperties{}, provisioning.MakeErrTimeIntervalInvalid(err)
	}

	return v1.TimeInterval{
		ResourceMetadata: v1.ResourceMetadata{
			UID:        v1.ResourceUID(interval.Name),
			Version:    interval.ResourceVersion,
			Provenance: prov,
		},
		Title:         interval.Spec.Name,
		TimeIntervals: timeIntervals,
	}, managerProps, nil
}

// extractManagerProperties resolves the ManagerProperties for an inbound object, preferring the
// manager annotations (richer than the coarse provenance annotation) when present and validating
// that they agree with any explicit provenance annotation. It falls back to deriving
// ManagerProperties from the provenance annotation for objects that pre-date ManagerProperties.
func extractManagerProperties(interval *model.TimeInterval) (utils.ManagerProperties, ngmodels.Provenance, error) {
	meta, err := utils.MetaAccessor(interval)
	if err != nil {
		return utils.ManagerProperties{}, "", fmt.Errorf("failed to get metadata: %w", err)
	}
	if mp, ok := meta.GetManagerProperties(); ok {
		if sourceProv := interval.GetProvenanceStatus(); sourceProv != "" && sourceProv != string(ngmodels.ProvenanceNone) {
			derivedProv := string(ngmodels.ManagerPropertiesToProvenance(mp))
			if derivedProv != sourceProv {
				return utils.ManagerProperties{}, "", fmt.Errorf("manager properties (kind=%s) and provenance annotation (%s) are inconsistent: manager properties imply provenance %q",
					mp.Kind, sourceProv, derivedProv)
			}
		}
		return mp, ngmodels.ManagerPropertiesToProvenance(mp), nil
	}

	prov, err := ngmodels.ProvenanceFromString(interval.GetProvenanceStatus())
	if err != nil {
		return utils.ManagerProperties{}, "", err
	}
	return ngmodels.ProvenanceToManagerProperties(prov), prov, nil
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
