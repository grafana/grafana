package prometheusrulegroup

import (
	"context"
	"errors"
	"fmt"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	model "github.com/grafana/grafana/apps/alerting/rules/pkg/apis/alerting/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/folder"
	ngmodels "github.com/grafana/grafana/pkg/services/ngalert/models"
	"github.com/grafana/grafana/pkg/services/ngalert/provisioning"
)

var _ grafanarest.Storage = (*legacyStorage)(nil)

// defaultFolderTitle is the title used when auto-creating a folder for rule groups
// posted without an explicit folder annotation.
const defaultFolderTitle = "PrometheusRules"

type legacyStorage struct {
	service         provisioning.AlertRuleService
	resolver        NamespaceResolver
	namespacer      request.NamespaceMapper
	defaultInterval time.Duration
	tableConverter  rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object     { return ResourceInfo.NewFunc() }
func (s *legacyStorage) Destroy()                {}
func (s *legacyStorage) NamespaceScoped() bool   { return true }
func (s *legacyStorage) GetSingularName() string { return ResourceInfo.GetSingularName() }
func (s *legacyStorage) NewList() runtime.Object { return ResourceInfo.NewListFunc() }

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	hasProm := true
	groups, err := s.service.GetAlertGroupsWithFolderFullpath(ctx, user, &provisioning.FilterOptions{
		HasPrometheusRuleDefinition: &hasProm,
	})
	if err != nil {
		return nil, err
	}

	list := &model.PrometheusRuleGroupList{
		Items: make([]model.PrometheusRuleGroup, 0, len(groups)),
	}
	for i := range groups {
		group := groups[i].AlertRuleGroup
		k8s, err := convertToK8sResource(info.OrgID, group, group.Provenance, s.namespacer)
		if err != nil {
			if errors.Is(err, errMissingOriginalRule) {
				// Skip groups whose rules were converted without OriginalRuleDefinition (e.g.
				// older /api/convert imports). Pattern-match reverse is out of scope for the spike.
				continue
			}
			return nil, err
		}
		list.Items = append(list.Items, *k8s)
	}
	return list, nil
}

// findGroupByName looks up a converted-Prometheus group by its name. Group names are not
// globally unique (the same name can exist in multiple folders), so we filter to rules
// that carry the Prometheus definition metadata and expect at most one match per org.
func (s *legacyStorage) findGroupByName(ctx context.Context, user identity.Requester, name string) (*ngmodels.AlertRuleGroup, ngmodels.Provenance, error) {
	hasProm := true
	groups, err := s.service.GetAlertGroupsWithFolderFullpath(ctx, user, &provisioning.FilterOptions{
		HasPrometheusRuleDefinition: &hasProm,
		RuleGroups:                  []string{name},
	})
	if err != nil {
		return nil, "", err
	}
	if len(groups) == 0 {
		return nil, "", k8serrors.NewNotFound(ResourceInfo.GroupResource(), name)
	}
	if len(groups) > 1 {
		return nil, "", fmt.Errorf("ambiguous group name %q matches %d groups across folders", name, len(groups))
	}
	g := groups[0].AlertRuleGroup
	return g, g.Provenance, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}

	group, provenance, err := s.findGroupByName(ctx, user, name)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, group, provenance, s.namespacer)
}

func (s *legacyStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, err
	}
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}

	g, ok := obj.(*model.PrometheusRuleGroup)
	if !ok {
		return nil, k8serrors.NewBadRequest("expected a PrometheusRuleGroup object")
	}
	if g.GenerateName != "" {
		return nil, fmt.Errorf("generate-name is not supported in legacy storage mode")
	}
	if g.Name != "" && g.Spec.Name != "" && g.Name != g.Spec.Name {
		return nil, k8serrors.NewBadRequest("metadata.name and spec.name must match")
	}
	if g.Spec.Name == "" {
		g.Spec.Name = g.Name
	}

	folderUID := annotationValue(g.Annotations, model.FolderAnnotationKey)
	if folderUID == "" {
		folderUID, err = s.resolveDefaultFolder(ctx, user)
		if err != nil {
			return nil, err
		}
	}
	datasourceUID := annotationValue(g.Annotations, DatasourceUIDAnnotationKey)

	domainGroup, provenance, err := convertToDomainGroup(info.OrgID, folderUID, datasourceUID, s.defaultInterval, g)
	if err != nil {
		return nil, err
	}
	if err := s.service.ReplaceRuleGroup(ctx, user, *domainGroup, provenance, "Created via PrometheusRuleGroup"); err != nil {
		return nil, err
	}

	stored, _, err := s.findGroupByName(ctx, user, g.Spec.Name)
	if err != nil {
		return nil, err
	}
	return convertToK8sResource(info.OrgID, stored, provenance, s.namespacer)
}

func (s *legacyStorage) resolveDefaultFolder(ctx context.Context, user identity.Requester) (string, error) {
	if s.resolver == nil {
		return "", fmt.Errorf("no folder annotation set and no default-folder resolver configured")
	}
	ref, _, err := s.resolver.GetOrCreateNamespaceByTitle(ctx, defaultFolderTitle, user.GetOrgID(), user, folder.RootFolderUID)
	if err != nil {
		return "", fmt.Errorf("failed to resolve default folder %q: %w", defaultFolderTitle, err)
	}
	return ref.UID, nil
}

func (s *legacyStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, _ rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	info, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, false, err
	}
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	obj, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return old, false, err
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, obj, old); err != nil {
			return nil, false, err
		}
	}

	g, ok := obj.(*model.PrometheusRuleGroup)
	if !ok {
		return nil, false, k8serrors.NewBadRequest("expected a PrometheusRuleGroup object")
	}
	if g.Spec.Name != "" && g.Spec.Name != name {
		return nil, false, k8serrors.NewBadRequest("spec.name cannot change after creation")
	}
	if g.Spec.Name == "" {
		g.Spec.Name = name
	}

	folderUID := annotationValue(g.Annotations, model.FolderAnnotationKey)
	if folderUID == "" {
		folderUID, err = s.resolveDefaultFolder(ctx, user)
		if err != nil {
			return nil, false, err
		}
	}
	datasourceUID := annotationValue(g.Annotations, DatasourceUIDAnnotationKey)

	domainGroup, provenance, err := convertToDomainGroup(info.OrgID, folderUID, datasourceUID, s.defaultInterval, g)
	if err != nil {
		return nil, false, err
	}
	if err := s.service.ReplaceRuleGroup(ctx, user, *domainGroup, provenance, "Updated via PrometheusRuleGroup"); err != nil {
		return nil, false, err
	}

	stored, _, err := s.findGroupByName(ctx, user, g.Spec.Name)
	if err != nil {
		return nil, false, err
	}
	updated, err := convertToK8sResource(info.OrgID, stored, provenance, s.namespacer)
	if err != nil {
		return nil, false, err
	}
	return updated, false, nil
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	user, err := identity.GetRequester(ctx)
	if err != nil {
		return nil, false, err
	}

	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return old, false, err
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, old); err != nil {
			return nil, false, err
		}
	}

	g, ok := old.(*model.PrometheusRuleGroup)
	if !ok {
		return nil, false, k8serrors.NewBadRequest("expected a PrometheusRuleGroup object")
	}
	// folderUID may be empty when the group lives in the root ("General") folder.
	folderUID := annotationValue(g.Annotations, model.FolderAnnotationKey)
	provenance := ngmodels.Provenance(g.GetProvenanceStatus())
	if err := s.service.DeleteRuleGroup(ctx, user, folderUID, g.Spec.Name, provenance); err != nil {
		return old, false, err
	}
	return old, false, nil
}

func annotationValue(annotations map[string]string, key string) string {
	if annotations == nil {
		return ""
	}
	return annotations[key]
}
