package datasource

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"iter"
	"maps"
	"strconv"
	"strings"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
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

func (r *converter) asDataSource(ds *datasources.DataSource) (*datasourceV0.DataSource, error) {
	cfg := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{
			Name:              ds.UID,
			Namespace:         r.mapper(ds.OrgID),
			CreationTimestamp: metav1.NewTime(ds.Created),
			ResourceVersion:   fmt.Sprintf("%d", ds.Updated.UnixMilli()),
			Generation:        int64(ds.Version),
		},
		Spec: datasourceV0.DataSourceSpec{
			Title:           ds.Name,
			Access:          datasourceV0.DsAccess(ds.Access),
			URL:             ds.URL,
			User:            ds.User,
			Database:        ds.Database,
			BasicAuth:       ds.BasicAuth,
			BasicAuthUser:   ds.BasicAuthUser,
			WithCredentials: ds.WithCredentials,
			IsDefault:       ds.IsDefault,
			ReadOnly:        ds.ReadOnly,
		},
		Secure: ToInlineSecureValues(ds.Type, ds.UID, maps.Keys(ds.SecureJsonData)),
	}
	cfg.UID = gapiutil.CalculateClusterWideUID(cfg)

	if ds.ID > 0 {
		cfg.Labels = map[string]string{
			utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(ds.ID, 10),
		}
	}

	if ds.JsonData != nil {
		val, ok := ds.JsonData.Interface().(map[string]any)
		if !ok {
			return nil, fmt.Errorf("expected map[string]any jsondata")
		}
		cfg.Spec.JsonData.Object = val
	}

	return cfg, nil
}

// ToInlineSecureValues converts secure json into InlineSecureValues with reference names
// The names are predictable and can be used while we implement dual writing for secrets
func ToInlineSecureValues(dsType string, dsUID string, keys iter.Seq[string]) common.InlineSecureValues {
	values := make(common.InlineSecureValues)
	for k := range keys {
		h := sha256.New()
		h.Write([]byte(dsType)) // plugin id
		h.Write([]byte("|"))
		h.Write([]byte(dsUID)) // unique identifier
		h.Write([]byte("|"))
		h.Write([]byte(k)) // property name
		n := hex.EncodeToString(h.Sum(nil))
		values[k] = common.InlineSecureValue{
			Name: "ds-" + n[0:10], // predictable name for dual writing
		}
	}
	if len(values) == 0 {
		return nil
	}
	return values
}

func (r *converter) toAddCommand(ds *datasourceV0.DataSource) (*datasources.AddDataSourceCommand, error) {
	if r.group != "" && !strings.HasPrefix(ds.APIVersion, r.group) {
		return nil, fmt.Errorf("expecting APIGroup: %s", r.group)
	}
	info, err := types.ParseNamespace(ds.Namespace)
	if err != nil {
		return nil, err
	}

	cmd := &datasources.AddDataSourceCommand{
		Name:  ds.Spec.Title,
		UID:   ds.Name,
		OrgID: info.OrgID,
		Type:  r.dstype,

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

	cmd.SecureJsonData, err = toSecureJsonData(ds)
	return cmd, err
}

func (r *converter) toUpdateCommand(ds *datasourceV0.DataSource) (*datasources.UpdateDataSourceCommand, error) {
	if r.group != "" && !strings.HasPrefix(ds.APIVersion, r.group) {
		return nil, fmt.Errorf("expecting APIGroup: %s", r.group)
	}
	info, err := types.ParseNamespace(ds.Namespace)
	if err != nil {
		return nil, err
	}

	cmd := &datasources.UpdateDataSourceCommand{
		Name:  ds.Spec.Title,
		UID:   ds.Name,
		OrgID: info.OrgID,
		Type:  r.dstype,

		Access:          datasources.DsAccess(ds.Spec.Access),
		URL:             ds.Spec.URL,
		Database:        ds.Spec.Database,
		User:            ds.Spec.User,
		BasicAuth:       ds.Spec.BasicAuth,
		BasicAuthUser:   ds.Spec.BasicAuthUser,
		WithCredentials: ds.Spec.WithCredentials,
		IsDefault:       ds.Spec.IsDefault,
		ReadOnly:        ds.Spec.ReadOnly,

		// The only field different than add
		Version: int(ds.Generation),
	}

	if len(ds.Spec.JsonData.Object) > 0 {
		cmd.JsonData = simplejson.NewFromAny(ds.Spec.JsonData.Object)
	}
	cmd.SecureJsonData, err = toSecureJsonData(ds)
	return cmd, err
}

func toSecureJsonData(ds *datasourceV0.DataSource) (map[string]string, error) {
	if ds == nil || len(ds.Secure) < 1 {
		return nil, nil
	}

	secure := map[string]string{}
	for k, v := range ds.Secure {
		if v.Create != "" {
			secure[k] = v.Create.DangerouslyExposeAndConsumeValue()
		}
		if v.Remove {
			secure[k] = "" // Weirdly, this is the best we can do with the legacy API :(
		}
	}
	return secure, nil
}
