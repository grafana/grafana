package templategroup

import (
	"fmt"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/fields"
	"k8s.io/apimachinery/pkg/types"

	model "github.com/grafana/grafana/apps/alerting/notifications/pkg/apis/alertingnotifications/v1beta1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	v1 "github.com/grafana/grafana/pkg/services/ngalert/notifier/legacy_storage/v1"

	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
)

func convertToK8sResources(orgID int64, list []v1.TemplateGroup, managerPropsMap map[string]utils.ManagerProperties, namespacer request.NamespaceMapper, selector fields.Selector) (*model.TemplateGroupList, error) {
	result := &model.TemplateGroupList{}
	for _, t := range list {
		item := convertToK8sResource(orgID, t, managerPropsMap[string(t.UID)], namespacer)
		if selector != nil && !selector.Empty() && !selector.Matches(model.TemplateGroupSelectableFields(item)) {
			continue
		}
		result.Items = append(result.Items, *item)
	}
	return result, nil
}

func convertToK8sResource(orgID int64, template v1.TemplateGroup, managerProps utils.ManagerProperties, namespacer request.NamespaceMapper) *model.TemplateGroup {
	result := &model.TemplateGroup{
		TypeMeta: metav1.TypeMeta{
			APIVersion: kind.GroupVersionKind().GroupVersion().String(),
			Kind:       kind.Kind(),
		},
		ObjectMeta: metav1.ObjectMeta{
			UID:             types.UID(template.UID),
			Name:            string(template.UID),
			Namespace:       namespacer(orgID),
			ResourceVersion: template.Version,
		},
		Spec: model.TemplateGroupSpec{
			Title:   template.Title,
			Content: template.Content,
			Kind:    model.TemplateGroupTemplateKind(template.Kind),
		},
	}
	// Prefer the richer manager-derived provenance; fall back to whatever provenance the
	// caller already resolved (e.g. the synthetic default template's "system" sentinel).
	provenance := template.Provenance
	if managerProps.Kind != utils.ManagerKindUnknown {
		provenance = ngmodels.ManagerPropertiesToProvenance(managerProps)
	}
	result.SetProvenanceStatus(string(provenance))
	result.UID = gapiutil.CalculateClusterWideUID(result)

	if managerProps.Kind != utils.ManagerKindUnknown {
		if meta, err := utils.MetaAccessor(result); err == nil {
			meta.SetManagerProperties(managerProps)
		}
	}

	return result
}

func convertToDomainModel(template *model.TemplateGroup) (v1.TemplateGroup, utils.ManagerProperties, error) {
	managerProps, prov, err := extractManagerProperties(template)
	if err != nil {
		return v1.TemplateGroup{}, utils.ManagerProperties{}, err
	}
	return v1.TemplateGroup{
		ResourceMetadata: v1.ResourceMetadata{
			UID:        v1.ResourceUID(template.Name),
			Version:    template.ResourceVersion,
			Provenance: prov,
		},
		Title:   template.Spec.Title,
		Content: template.Spec.Content,
		Kind:    v1.TemplateKind(template.Spec.Kind),
	}, managerProps, nil
}

// extractManagerProperties resolves the ManagerProperties for an inbound object, preferring the
// manager annotations (richer than the coarse provenance annotation) when present and validating
// that they agree with any explicit provenance annotation. It falls back to deriving
// ManagerProperties from the provenance annotation for objects that pre-date ManagerProperties.
func extractManagerProperties(template *model.TemplateGroup) (utils.ManagerProperties, ngmodels.Provenance, error) {
	meta, err := utils.MetaAccessor(template)
	if err != nil {
		return utils.ManagerProperties{}, "", fmt.Errorf("failed to get metadata: %w", err)
	}
	if mp, ok := meta.GetManagerProperties(); ok {
		if sourceProv := template.GetProvenanceStatus(); sourceProv != "" && sourceProv != string(ngmodels.ProvenanceNone) {
			derivedProv := string(ngmodels.ManagerPropertiesToProvenance(mp))
			if derivedProv != sourceProv {
				return utils.ManagerProperties{}, "", fmt.Errorf("manager properties (kind=%s) and provenance annotation (%s) are inconsistent: manager properties imply provenance %q",
					mp.Kind, sourceProv, derivedProv)
			}
		}
		return mp, ngmodels.ManagerPropertiesToProvenance(mp), nil
	}

	prov, err := ngmodels.ProvenanceFromString(template.GetProvenanceStatus())
	if err != nil {
		return utils.ManagerProperties{}, "", err
	}
	return ngmodels.ProvenanceToManagerProperties(prov), prov, nil
}
