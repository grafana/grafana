package appplugin

import (
	"context"
	"encoding/json"
	"fmt"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

type ctxAppDTO struct{}

type shimDTO struct {
	dto *pluginsettings.DTO
}

// This can be removed when we no longer support loading directly from the legacy SQL store
func withShimDTO(ctx context.Context) context.Context {
	return context.WithValue(ctx, ctxAppDTO{}, &shimDTO{})
}

func shimFromContext(ctx context.Context) *shimDTO {
	shim, ok := ctx.Value(ctxAppDTO{}).(*shimDTO)
	if !ok {
		return nil
	}
	return shim
}

// Gets plugin context with decrypted secure values
func (b *AppPluginAPIBuilder) getPluginContext(ctx context.Context) (context.Context, backend.PluginContext, error) {
	ctx = withShimDTO(ctx)
	raw, err := b.getter.Get(ctx, apppluginV0.INSTANCE_NAME, &v1.GetOptions{})
	if err != nil {
		return ctx, backend.PluginContext{}, err
	}
	settings, ok := raw.(*apppluginV0.Settings)
	if !ok {
		return ctx, backend.PluginContext{}, fmt.Errorf("unexpected type %T when getting plugin settings", raw)
	}
	if !settings.Spec.Enabled {
		return ctx, backend.PluginContext{}, k8serrors.NewBadRequest("plugin is not enabled")
	}

	instance := &backend.AppInstanceSettings{
		APIVersion: b.groupVersion.Version,
	}
	instance.JSONData, err = json.Marshal(settings.Spec.JsonData)
	if err != nil {
		return ctx, backend.PluginContext{}, fmt.Errorf("error marshalling JsonData: %w", err)
	}

	if len(settings.Secure) > 0 {
		shim := shimFromContext(ctx)
		if shim != nil && shim.dto != nil && b.pluginSettings != nil {
			// Odd this does not have an error???!!
			instance.DecryptedSecureJSONData = b.pluginSettings.DecryptedValues(shim.dto)
		} else {
			names := make([]string, 0, len(settings.Secure))
			for k, v := range settings.Secure {
				if v.Name == "" {
					return ctx, backend.PluginContext{}, fmt.Errorf("invalid secure value name: %s: %w", k, err)
				}
				names = append(names, v.Name)
			}
			lookup, err := b.decrypter.Decrypt(ctx, b.groupVersion.Group, settings.Namespace, names...)
			if err != nil {
				return ctx, backend.PluginContext{}, fmt.Errorf("error decrypting secure values: %w", err)
			}

			instance.DecryptedSecureJSONData = make(map[string]string)
			for k, sv := range settings.Secure {
				v := lookup[sv.Name]
				if v.Error() != nil {
					return ctx, backend.PluginContext{}, fmt.Errorf("error decrypting secure value: %s / %w", k, err)
				}
				instance.DecryptedSecureJSONData[k] = string(*v.Value())
			}
		}
	}

	return b.contextProvider.PluginContextForApp(ctx, b.pluginJSON.ID, instance)
}
