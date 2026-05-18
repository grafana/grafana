package plugins

import (
	"context"
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	pluginsV0 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

var (
	_ grafanarest.Storage = (*legacyStorage)(nil)
)

type legacyStorage struct {
	pluginSettings pluginsettings.Service
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object {
	return pluginsV0.AppKind().ZeroValue()
}

func (s *legacyStorage) Destroy() {}

func (s *legacyStorage) NamespaceScoped() bool {
	return true // namespace == org
}

func (s *legacyStorage) GetSingularName() string {
	return strings.ToLower(pluginsV0.AppKind().Kind())
}

func (s *legacyStorage) NewList() runtime.Object {
	return pluginsV0.AppKind().ZeroListValue()
}

func (s *legacyStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.tableConverter.ConvertToTable(ctx, object, tableOptions)
}

func (s *legacyStorage) List(ctx context.Context, options *internalversion.ListOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	settings, err := s.pluginSettings.GetPluginSettings(ctx, &pluginsettings.GetArgs{OrgID: orgID})
	if err != nil {
		return nil, err
	}
	apps := &pluginsV0.AppList{
		Items: make([]pluginsV0.App, 0, len(settings)),
	}
	for _, dto := range settings {
		s := toAppInstall(dto, now())
		apps.Items = append(apps.Items, *s)
	}
	return apps, nil
}

func (s *legacyStorage) Get(ctx context.Context, name string, options *metav1.GetOptions) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}

	setting, err := s.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		OrgID:    orgID,
		PluginID: name,
	})
	if err != nil {
		return nil, err
	}
	if setting == nil {
		return nil, fmt.Errorf("not found")
	}

	return toAppInstall(&pluginsettings.InfoDTO{
		PluginID: setting.PluginID,
		Enabled:  setting.Enabled,
		Pinned:   setting.Pinned,
	}, now()), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	resource, ok := obj.(*pluginsV0.App)
	if !ok {
		return nil, fmt.Errorf("expected app")
	}

	return s.update(ctx, resource.Name,
		resource.Spec.Enabled,
		resource.Spec.Pinned,
	)
}

func (s *legacyStorage) Update(ctx context.Context,
	name string,
	objInfo rest.UpdatedObjectInfo,
	createValidation rest.ValidateObjectFunc,
	updateValidation rest.ValidateObjectUpdateFunc,
	forceAllowCreate bool,
	options *metav1.UpdateOptions,
) (runtime.Object, bool, error) {
	before, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return nil, false, err
	}
	obj, err := objInfo.UpdatedObject(ctx, before)
	if err != nil {
		return nil, false, err
	}

	changed, ok := obj.(*pluginsV0.App)
	if !ok {
		return nil, false, fmt.Errorf("expected app")
	}

	obj, err = s.update(ctx, name,
		changed.Spec.Enabled,
		changed.Spec.Pinned,
	)
	return obj, false, err
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// In legacy delete is the same as disable
	obj, err := s.update(ctx, name, false, false)
	return obj, false, err
}

func (s *legacyStorage) update(ctx context.Context, name string, enabled, pinned bool) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}
	err = s.pluginSettings.UpdatePluginSetting(ctx, &pluginsettings.UpdateArgs{
		PluginID: name,
		OrgID:    orgID,
		Enabled:  enabled,
		Pinned:   pinned,
		// The rest of the properties stay the same
	})
	if err != nil {
		return nil, err
	}
	return s.Get(ctx, name, &metav1.GetOptions{})
}

func toAppInstall(dto *pluginsettings.InfoDTO, ts metav1.Time) *pluginsV0.App {
	obj := &pluginsV0.App{
		ObjectMeta: metav1.ObjectMeta{
			Name:              dto.PluginID,
			CreationTimestamp: ts,
			ResourceVersion:   fmt.Sprintf("%d", ts.UnixMilli()),
		},
		Spec: pluginsV0.AppSpec{
			Enabled: dto.Enabled,
			Pinned:  dto.Pinned,
		},
	}
	obj.UID = gapiutil.CalculateClusterWideUID(obj)
	return obj
}

// Populate a new time whenever this is called -- use this function for tests
var now = func() metav1.Time {
	return metav1.Now()
}
