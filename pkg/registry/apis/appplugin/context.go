package appplugin

import (
	"context"
	"encoding/json"
	"fmt"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

func (b *AppPluginAPIBuilder) getSettings(ctx context.Context) (*apppluginV0.Settings, pluginsettings.DecryptedSecureJSONLoader, error) {
	ctx = pluginsettings.WithSecureContextShim(ctx)
	raw, err := b.getter.Get(ctx, apppluginV0.INSTANCE_NAME, &v1.GetOptions{})
	if err != nil {
		return nil, nil, err
	}
	settings, ok := raw.(*apppluginV0.Settings)
	if !ok {
		return nil, nil, fmt.Errorf("unexpected type %T when getting plugin settings", raw)
	}
	if !settings.Spec.Enabled {
		return nil, nil, k8serrors.NewBadRequest("plugin is not enabled")
	}

	if len(settings.Secure) < 1 {
		return settings, pluginsettings.EmptyDecryptedSecureJSONLoader, nil
	}

	obj, err := utils.MetaAccessor(settings)
	if err != nil {
		return nil, nil, err
	}

	loader, err := pluginsettings.GetDecryptedSecureJSONLoader(ctx, obj, b.decrypter)
	return settings, loader, err
}

// Gets plugin context with decrypted secure values
func (b *AppPluginAPIBuilder) getPluginContext(ctx context.Context) (context.Context, backend.PluginContext, error) {
	settings, secure, err := b.getSettings(ctx)
	if err != nil {
		return ctx, backend.PluginContext{}, err
	}
	instance := &backend.AppInstanceSettings{
		APIVersion: b.groupVersion.Version,
	}
	instance.JSONData, err = json.Marshal(settings.Spec.JsonData)
	if err != nil {
		return ctx, backend.PluginContext{}, fmt.Errorf("error marshalling JsonData: %w", err)
	}
	instance.DecryptedSecureJSONData, err = secure(ctx)
	if err != nil {
		return ctx, backend.PluginContext{}, fmt.Errorf("error decrypting secure values: %w", err)
	}
	return b.contextProvider.PluginContextForApp(ctx, b.pluginJSON.ID, instance)
}
