package datasource

import (
	"context"
	"encoding/json"
	"fmt"

	v1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/utils/ptr"

	"github.com/grafana/grafana-plugin-sdk-go/backend"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/services/pluginsintegration/pluginsettings"
)

func (b *DataSourceAPIBuilder) getInstanceSettings(ctx context.Context, name string) (*backend.DataSourceInstanceSettings, error) {
	ctx = pluginsettings.WithSecureContextShim(ctx)
	raw, err := b.store.Get(ctx, name, &v1.GetOptions{})
	if err != nil {
		return nil, err
	}
	ds, ok := raw.(*datasourceV0.DataSource)
	if !ok {
		return nil, fmt.Errorf("unexpected type %T when getting plugin settings", raw)
	}

	obj, err := utils.MetaAccessor(ds)
	if err != nil {
		return nil, err
	}

	ts, _ := obj.GetUpdatedTimestamp()
	if ts == nil {
		ts = ptr.To(obj.GetCreationTimestamp().Time)
	}

	gvk := obj.GetGroupVersionKind()
	if gvk.Version == "" {
		gvk.Version = datasourceV0.VERSION
	}

	settings := &backend.DataSourceInstanceSettings{
		UID:              ds.Name,
		Type:             b.pluginJSON.ID,
		URL:              ds.Spec.URL(),
		ID:               obj.GetDeprecatedInternalID(), // nolint:staticcheck
		Name:             ds.Spec.Title(),
		User:             ds.Spec.User(),
		Database:         ds.Spec.Database(),
		BasicAuthEnabled: ds.Spec.BasicAuth(),
		BasicAuthUser:    ds.Spec.BasicAuthUser(),
		Updated:          *ts,
		APIVersion:       gvk.Version,
	}

	settings.JSONData, err = json.Marshal(ds.Spec.JSONData())
	if err != nil {
		return nil, err
	}

	if len(ds.Secure) < 1 {
		return settings, nil
	}

	loader, err := pluginsettings.GetDecryptedSecureJSONLoader(ctx, obj, b.decrypter)
	if err != nil {
		return nil, err
	}
	settings.DecryptedSecureJSONData, err = loader(ctx)
	return settings, err
}
