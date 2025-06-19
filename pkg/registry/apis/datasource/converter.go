package datasource

import (
	"fmt"

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

	if ds.JsonData != nil {
		val, ok := ds.JsonData.Interface().(map[string]any)
		if !ok {
			return nil, fmt.Errorf("expected map[string]any jsondata")
		}
		cfg.Spec.JsonData.Object = val
	}

	if ds.SecureJsonData != nil {
		cfg.Secure = make(map[string]bool)
		for k := range ds.SecureJsonData {
			cfg.Secure[k] = true
		}
	}

	return cfg, nil
}

func (r *converter) toAddCommand(ds *v0alpha1.GenericDataSource) (*datasources.AddDataSourceCommand, error) {
	cmd := &datasources.AddDataSourceCommand{
		Name:     ds.Name,
		Type:     "", // TODO... group > datasource type????
		Access:   datasources.DsAccess(ds.Spec.Access),
		URL:      ds.Spec.URL,
		Database: ds.Spec.Database,
		// TODO... secrets
	}

	if len(ds.Spec.JsonData.Object) > 0 {
		cmd.JsonData = simplejson.NewFromAny(ds.Spec.JsonData.Object)
	}

	return cmd, nil
}

func (r *converter) toUpdateCommand(ds *v0alpha1.GenericDataSource) (*datasources.UpdateDataSourceCommand, error) {
	cmd := &datasources.UpdateDataSourceCommand{}
	// TODO!!!
	return cmd, nil
}
