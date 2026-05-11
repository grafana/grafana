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
	getDecryptedSecureJSONData pluginsettings.SecureJsonGetter
}

// This can be removed when we no longer support loading directly from the legacy SQL store
func withShimDTO(ctx context.Context) context.Context {
	return context.WithValue(ctx, ctxAppDTO{}, &shimDTO{})
}

func legacyShimFromContext(ctx context.Context) *shimDTO {
	shim, ok := ctx.Value(ctxAppDTO{}).(*shimDTO)
	if !ok {
		return nil
	}
	return shim
}

func (b *AppPluginAPIBuilder) getSettings(ctx context.Context) (*apppluginV0.Settings, pluginsettings.SecureJsonGetter, error) {
	ctx = withShimDTO(ctx)
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
		return settings, func(ctx context.Context) (map[string]string, error) { return map[string]string{}, nil }, nil
	}

	shim := legacyShimFromContext(ctx)
	if shim != nil && shim.getDecryptedSecureJSONData != nil {
		return settings, shim.getDecryptedSecureJSONData, nil
	}

	// Returns settings and a function to get decrypted secure values
	return settings, func(ctx context.Context) (map[string]string, error) {
		names := make([]string, 0, len(settings.Secure))
		for k, v := range settings.Secure {
			if v.Name == "" {
				return nil, fmt.Errorf("missing secure value name for key: %s", k)
			}
			names = append(names, v.Name)
		}
		lookup, err := b.decrypter.Decrypt(ctx, b.groupVersion.Group, settings.Namespace, names...)
		if err != nil {
			return nil, fmt.Errorf("error decrypting secure values: %w", err)
		}

		decrypted := make(map[string]string)
		for k, sv := range settings.Secure {
			v, ok := lookup[sv.Name]
			if !ok {
				return nil, fmt.Errorf("unable to find secure value: %s for key: %s", sv.Name, k)
			}
			if v.Error() != nil {
				return nil, fmt.Errorf("error decrypting secure value: %s / %w", k, v.Error())
			}
			val := v.Value()
			if val != nil {
				decrypted[k] = val.DangerouslyExposeAndConsumeValue()
			}
		}
		return decrypted, nil
	}, nil
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
