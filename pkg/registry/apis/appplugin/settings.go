package appplugin

import (
	"context"
	"errors"
	"fmt"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/apis/meta/internalversion"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	"k8s.io/apiserver/pkg/registry/rest"

	"github.com/grafana/grafana/pkg/apimachinery/utils"

	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	apppluginv0alpha1 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	grafanarest "github.com/grafana/grafana/pkg/apiserver/rest"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

type settingsStorage struct {
	pluginID       string
	pluginSettings pluginsettings.Service
	resourceInfo   *utils.ResourceInfo
}

var _ grafanarest.Storage = (*settingsStorage)(nil)

func (s *settingsStorage) New() runtime.Object {
	return s.resourceInfo.NewFunc()
}

func (s *settingsStorage) Destroy() {}

func (s *settingsStorage) NamespaceScoped() bool {
	return true
}

func (s *settingsStorage) GetSingularName() string {
	return s.resourceInfo.GetSingularName()
}

func (s *settingsStorage) NewList() runtime.Object {
	return s.resourceInfo.NewListFunc()
}

func (s *settingsStorage) ConvertToTable(ctx context.Context, object runtime.Object, tableOptions runtime.Object) (*metav1.Table, error) {
	return s.resourceInfo.TableConverter().ConvertToTable(ctx, object, tableOptions)
}

func (s *settingsStorage) Get(ctx context.Context, name string, _ *metav1.GetOptions) (runtime.Object, error) {
	if name != s.pluginID {
		return nil, apierrors.NewNotFound(s.resourceInfo.GroupResource(), name)
	}

	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	obj := &apppluginv0alpha1.Settings{
		ObjectMeta: metav1.ObjectMeta{
			Name:      name,
			Namespace: nsInfo.Value,
		},
	}

	ps, err := s.pluginSettings.GetPluginSettingByPluginID(ctx, &pluginsettings.GetByPluginIDArgs{
		PluginID: s.pluginID,
		OrgID:    nsInfo.OrgID,
	})
	if err != nil && !errors.Is(err, pluginsettings.ErrPluginSettingNotFound) {
		return nil, fmt.Errorf("failed to get plugin settings: %w", err)
	}
	if err == nil {
		obj.Spec.Enabled = ps.Enabled
		obj.Spec.Pinned = ps.Pinned
		obj.Spec.JsonData = common.Unstructured{Object: ps.JSONData}

		secureFields := make(map[string]bool, len(ps.SecureJSONData))
		for k, v := range ps.SecureJSONData {
			secureFields[k] = len(v) > 0
		}
		obj.Spec.SecureJsonFields = secureFields
	}

	return obj, nil
}

func (s *settingsStorage) List(ctx context.Context, _ *internalversion.ListOptions) (runtime.Object, error) {
	obj, err := s.Get(ctx, s.pluginID, nil)
	if err != nil {
		return nil, err
	}
	return &apppluginv0alpha1.SettingsList{
		Items: []apppluginv0alpha1.Settings{*obj.(*apppluginv0alpha1.Settings)},
	}, nil
}

func (s *settingsStorage) Create(ctx context.Context, obj runtime.Object, createValidation rest.ValidateObjectFunc, _ *metav1.CreateOptions) (runtime.Object, error) {
	if createValidation != nil {
		if err := createValidation(ctx, obj); err != nil {
			return nil, err
		}
	}
	return s.save(ctx, obj)
}

func (s *settingsStorage) Update(ctx context.Context, name string, objInfo rest.UpdatedObjectInfo, createValidation rest.ValidateObjectFunc, updateValidation rest.ValidateObjectUpdateFunc, _ bool, _ *metav1.UpdateOptions) (runtime.Object, bool, error) {
	old, err := s.Get(ctx, name, nil)
	if err != nil {
		return nil, false, err
	}

	updated, err := objInfo.UpdatedObject(ctx, old)
	if err != nil {
		return nil, false, err
	}

	if updateValidation != nil {
		if err := updateValidation(ctx, updated, old); err != nil {
			return nil, false, err
		}
	}

	obj, err := s.save(ctx, updated)
	return obj, false, err
}

func (s *settingsStorage) Delete(_ context.Context, _ string, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions) (runtime.Object, bool, error) {
	// pluginSettings does not support deletion
	return nil, false, nil
}

func (s *settingsStorage) DeleteCollection(_ context.Context, _ rest.ValidateObjectFunc, _ *metav1.DeleteOptions, _ *internalversion.ListOptions) (runtime.Object, error) {
	// pluginSettings does not support deletion
	return nil, nil
}

func (s *settingsStorage) save(ctx context.Context, obj runtime.Object) (runtime.Object, error) {
	p, ok := obj.(*apppluginv0alpha1.Settings)
	if !ok {
		return nil, fmt.Errorf("expected Settings object")
	}

	nsInfo, err := request.NamespaceInfoFrom(ctx, true)
	if err != nil {
		return nil, err
	}

	if err := s.pluginSettings.UpdatePluginSetting(ctx, &pluginsettings.UpdateArgs{
		PluginID: s.pluginID,
		OrgID:    nsInfo.OrgID,
		Enabled:  p.Spec.Enabled,
		Pinned:   p.Spec.Pinned,
		JSONData: p.Spec.JsonData.Object,
	}); err != nil {
		return nil, fmt.Errorf("failed to save plugin settings: %w", err)
	}

	return s.Get(ctx, s.pluginID, nil)
}
