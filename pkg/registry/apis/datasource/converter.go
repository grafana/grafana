package datasource

import (
	"fmt"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
)

type converter struct {
	mapper request.NamespaceMapper
	group  string // the expected group
	dstype string // the expected pluginId
}

func asConnection(ds *datasources.DataSource, ns string) (*v0alpha1.DataSourceConnection, error) {
	v := &v0alpha1.DataSourceConnection{
		ObjectMeta: metav1.ObjectMeta{
			Name:              ds.UID,
			Namespace:         ns,
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
			Generation:        int64(ds.Version),
		},
		Title: ds.Name,
	}
	v.UID = gapiutil.CalculateClusterWideUID(v) // indicates if the value changed on the server
	meta, err := utils.MetaAccessor(v)
	if err != nil {
		meta.SetUpdatedTimestamp(&ds.Updated)
	}
	return v, err
}

func (r *converter) asConnection(ds *datasources.DataSource) (*v0alpha1.DataSourceConnection, error) {
	return asConnection(ds, r.mapper(ds.OrgID))
}

func (r *converter) asGenericDataSource(ds *datasources.DataSource) (*v0alpha1.GenericDataSource, error) {
	cfg := &v0alpha1.GenericDataSource{
		ObjectMeta: metav1.ObjectMeta{
			Name:              ds.UID,
			Namespace:         r.mapper(ds.OrgID),
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
			Generation:        int64(ds.Version),
		},
		Spec: v0alpha1.GenericDataSourceSpec{
			Title:           ds.Name,
			Access:          v0alpha1.DsAccess(ds.Access),
			URL:             ds.URL,
			User:            ds.User,
			Database:        ds.Database,
			BasicAuth:       ds.BasicAuth,
			BasicAuthUser:   ds.BasicAuthUser,
			WithCredentials: ds.WithCredentials,
			IsDefault:       ds.IsDefault,
			ReadOnly:        ds.ReadOnly,
		},
	}
	cfg.UID = gapiutil.CalculateClusterWideUID(cfg)

	if ds.JsonData != nil {
		val, ok := ds.JsonData.Interface().(map[string]any)
		if !ok {
			return nil, fmt.Errorf("expected map[string]any jsondata")
		}
		cfg.Spec.JsonData.Object = val
	}

	if ds.SecureJsonData != nil {
		cfg.Secure = make(map[string]v0alpha1.SecureValue)
		for k := range ds.SecureJsonData {
			cfg.Secure[k] = v0alpha1.SecureValue{
				Reference: "~", // ????
			}
		}
	}

	return cfg, nil
}

func (r *converter) toAddCommand(ds *v0alpha1.GenericDataSource) (*datasources.AddDataSourceCommand, error) {
	if r.group != "" && !strings.HasPrefix(ds.APIVersion, r.group) {
		return nil, fmt.Errorf("expecting APIGroup: %s", r.group)
	}

	cmd := &datasources.AddDataSourceCommand{
		Name: ds.Spec.Title,
		UID:  ds.Name,
		Type: r.dstype,

		Access:          datasources.DsAccess(ds.Spec.Access),
		URL:             ds.Spec.URL,
		Database:        ds.Spec.Database,
		User:            ds.Spec.User,
		BasicAuth:       ds.Spec.BasicAuth,
		BasicAuthUser:   ds.Spec.BasicAuthUser,
		WithCredentials: ds.Spec.WithCredentials,
		IsDefault:       ds.Spec.IsDefault,
		ReadOnly:        ds.Spec.ReadOnly,
	}

	if len(ds.Spec.JsonData.Object) > 0 {
		cmd.JsonData = simplejson.NewFromAny(ds.Spec.JsonData.Object)
	}

	cmd.SecureJsonData = toSecureJsonData(ds)

	return cmd, nil
}

func (r *converter) toUpdateCommand(ds *v0alpha1.GenericDataSource) (*datasources.UpdateDataSourceCommand, error) {
	if r.group != "" && !strings.HasPrefix(ds.APIVersion, r.group) {
		return nil, fmt.Errorf("expecting APIGroup: %s", r.group)
	}

	cmd := &datasources.UpdateDataSourceCommand{
		Name: ds.Spec.Title,
		UID:  ds.Name,
		Type: r.dstype,

		Access:          datasources.DsAccess(ds.Spec.Access),
		URL:             ds.Spec.URL,
		Database:        ds.Spec.Database,
		User:            ds.Spec.User,
		BasicAuth:       ds.Spec.BasicAuth,
		BasicAuthUser:   ds.Spec.BasicAuthUser,
		WithCredentials: ds.Spec.WithCredentials,
		IsDefault:       ds.Spec.IsDefault,
		ReadOnly:        ds.Spec.ReadOnly,
	}

	if len(ds.Spec.JsonData.Object) > 0 {
		cmd.JsonData = simplejson.NewFromAny(ds.Spec.JsonData.Object)
	}
	cmd.SecureJsonData = toSecureJsonData(ds)

	// The only thing differnet from the add command???
	cmd.Version = int(ds.Generation)
	return cmd, nil
}

func toSecureJsonData(ds *v0alpha1.GenericDataSource) map[string]string {
	if ds == nil || len(ds.Secure) < 1 {
		return nil
	}

	secure := map[string]string{}
	for k, v := range ds.Secure {
		if v.Input != "" {
			secure[k] = v.Input
		}
		if v.Remove {
			secure[k] = "" // Weirdly, this is the best we can do with the legacy API :(
		}
	}
	return secure
}
