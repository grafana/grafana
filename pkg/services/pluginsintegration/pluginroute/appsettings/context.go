package appsettings

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	k8serrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime/schema"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	apppluginV0 "github.com/grafana/grafana/pkg/apis/appplugin/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

func (b *Builder) getSettings(ctx context.Context) (*apppluginV0.Settings, pluginsettings.DecryptedSecureJSONLoader, error) {
	ctx = pluginsettings.WithSecureContextShim(ctx)
	raw, err := b.getter(ctx, schema.GroupVersionResource{
		Group:    b.group,
		Version:  apppluginV0.VERSION,
		Resource: apppluginV0.APP_RESOURCE_NAME,
	}, apppluginV0.INSTANCE_NAME)
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

	// Unified secrets belong to the shared storage group, while settings use the served group.
	stored := settings.DeepCopy()
	stored.APIVersion = apppluginV0.GROUP + "/" + apppluginV0.VERSION
	obj, err := utils.MetaAccessor(stored)
	if err != nil {
		return nil, nil, err
	}

	loader, err := pluginsettings.GetDecryptedSecureJSONLoader(ctx, obj, b.decrypter)
	if err != nil {
		return nil, nil, err
	}
	return settings, b.secureValues.cached(settings.Namespace, settings.ResourceVersion, loader), nil
}

// secureValuesTTL matches how long the legacy plugin context keeps settings.
const secureValuesTTL = 5 * time.Second

// secureValuesCache keeps the decrypted secure values of each namespace's
// settings, so subresource requests do not decrypt them every time. An entry is
// reused only for the same resource version, and for at most secureValuesTTL.
type secureValuesCache struct {
	mu      sync.Mutex
	entries map[string]secureValuesEntry
	now     func() time.Time
}

type secureValuesEntry struct {
	resourceVersion string
	expires         time.Time
	values          map[string]string
}

func (c *secureValuesCache) cached(namespace, resourceVersion string, load pluginsettings.DecryptedSecureJSONLoader) pluginsettings.DecryptedSecureJSONLoader {
	if resourceVersion == "" {
		return load
	}
	return func(ctx context.Context) (map[string]string, error) {
		c.mu.Lock()
		now := c.clock()
		entry, ok := c.entries[namespace]
		c.mu.Unlock()
		if ok && entry.resourceVersion == resourceVersion && now.Before(entry.expires) {
			return entry.values, nil
		}

		values, err := load(ctx)
		if err != nil {
			return nil, err
		}
		c.mu.Lock()
		defer c.mu.Unlock()
		if c.entries == nil {
			c.entries = map[string]secureValuesEntry{}
		}
		// Expired entries are dropped, so decrypted values do not outlive the TTL
		// for namespaces that stop calling.
		for ns, e := range c.entries {
			if !now.Before(e.expires) {
				delete(c.entries, ns)
			}
		}
		c.entries[namespace] = secureValuesEntry{resourceVersion: resourceVersion, expires: now.Add(secureValuesTTL), values: values}
		return values, nil
	}
}

func (c *secureValuesCache) clock() time.Time {
	if c.now != nil {
		return c.now()
	}
	return time.Now()
}

// Gets plugin context with decrypted secure values
func (b *Builder) getPluginContext(ctx context.Context) (context.Context, backend.PluginContext, error) {
	settings, secure, err := b.getSettings(ctx)
	if err != nil {
		return ctx, backend.PluginContext{}, err
	}
	instance := &backend.AppInstanceSettings{APIVersion: apppluginV0.VERSION}
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
