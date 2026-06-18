package plugins

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	pluginsV0 "github.com/grafana/grafana/apps/plugins/pkg/apis/plugins/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

var _ grafanarest.Storage = (*legacyStorage)(nil)

type legacyStorage struct {
	pluginSettings pluginsettings.Service
	tableConverter rest.TableConvertor
}

func (s *legacyStorage) New() runtime.Object     { return pluginsV0.AppKind().ZeroValue() }
func (s *legacyStorage) NewList() runtime.Object { return pluginsV0.AppKind().ZeroListValue() }
func (s *legacyStorage) Destroy()                {}
func (s *legacyStorage) NamespaceScoped() bool   { return true } // namespace == org
func (s *legacyStorage) GetSingularName() string { return strings.ToLower(pluginsV0.AppKind().Kind()) }

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

	ts := now()
	list := &pluginsV0.AppList{Items: make([]pluginsV0.App, 0, len(settings))}
	for _, dto := range settings {
		ts.Add(time.Second) // given them different RV Values
		list.Items = append(list.Items, *toApp(dto.PluginID, dto.Enabled, dto.Pinned, ts))
	}
	return list, nil
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
	if err != nil && !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
		return nil, err
	}
	if setting == nil {
		return nil, k8serrors.NewNotFound(pluginsV0.AppKind().GroupVersionResource().GroupResource(), name)
	}
	return toApp(setting.PluginID, setting.Enabled, setting.Pinned, now()), nil
}

func (s *legacyStorage) Create(ctx context.Context,
	obj runtime.Object,
	createValidation rest.ValidateObjectFunc,
	options *metav1.CreateOptions,
) (runtime.Object, error) {
	app, ok := obj.(*pluginsV0.App)
	if !ok {
		return nil, fmt.Errorf("expected app")
	}
	if createValidation != nil {
		if err := createValidation(ctx, obj.DeepCopyObject()); err != nil {
			return nil, err
		}
	}
	return s.upsert(ctx, app.Name, app.Spec.Enabled, app.Spec.Pinned)
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
	app, ok := obj.(*pluginsV0.App)
	if !ok {
		return nil, false, fmt.Errorf("expected app")
	}
	if updateValidation != nil {
		if err := updateValidation(ctx, obj, before); err != nil {
			return nil, false, err
		}
	}
	out, err := s.upsert(ctx, name, app.Spec.Enabled, app.Spec.Pinned)
	return out, false, err
}

func (s *legacyStorage) Delete(ctx context.Context, name string, deleteValidation rest.ValidateObjectFunc, options *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// In legacy delete is the same as disable.
	existing, err := s.Get(ctx, name, &metav1.GetOptions{})
	if err != nil {
		return existing, false, err
	}
	if deleteValidation != nil {
		if err := deleteValidation(ctx, existing); err != nil {
			return existing, false, err
		}
	}
	out, err := s.upsert(ctx, name, false, false)
	return out, true, err
}

func (s *legacyStorage) upsert(ctx context.Context, name string, enabled, pinned bool) (runtime.Object, error) {
	orgID, err := request.OrgIDForList(ctx)
	if err != nil {
		return nil, err
	}
	if err := s.pluginSettings.UpdatePluginSetting(ctx, &pluginsettings.UpdateArgs{
		PluginID: name,
		OrgID:    orgID,
		Enabled:  enabled,
		Pinned:   pinned,
		// The rest of the properties stay the same
	}); err != nil {
		return nil, err
	}
	return s.Get(ctx, name, &metav1.GetOptions{})
}

func newAppsTableConverter() utils.TableConvertor {
	gvr := pluginsV0.AppKind().GroupVersionResource()
	return utils.NewTableConverter(
		gvr.GroupResource(),
		utils.TableColumns{
			Definition: []metav1.TableColumnDefinition{
				{Name: "Name", Type: "string", Format: "name"},
				{Name: "Enabled", Type: "boolean"},
				{Name: "Pinned", Type: "boolean"},
			},
			Reader: func(obj any) ([]any, error) {
				m, ok := obj.(*pluginsV0.App)
				if !ok {
					return nil, fmt.Errorf("expected app plugin")
				}
				return []any{m.Name, m.Spec.Enabled, m.Spec.Pinned}, nil
			},
		},
	)
}

func toApp(pluginID string, enabled, pinned bool, ts metav1.Time) *pluginsV0.App {
	obj := &pluginsV0.App{
		ObjectMeta: metav1.ObjectMeta{
			Name:              pluginID,
			CreationTimestamp: ts,
			ResourceVersion:   fmt.Sprintf("%d", ts.UnixMilli()),
		},
		Spec: pluginsV0.AppSpec{
			Enabled: enabled,
			Pinned:  pinned,
		},
	}
	obj.UID = gapiutil.CalculateClusterWideUID(obj)
	return obj
}

// Populate a new time whenever this is called -- use this function for tests
var now = func() metav1.Time {
	return metav1.Now()
}
