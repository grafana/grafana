package datasource

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"iter"
	"maps"
	"slices"
	"strconv"
	"strings"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"

	"github.com/grafana/authlib/types"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	datasourceV0 "github.com/grafana/grafana/pkg/apis/datasource/v0alpha1"
	"github.com/grafana/grafana/pkg/components/simplejson"
	"github.com/grafana/grafana/pkg/services/apiserver/endpoints/request"
	gapiutil "github.com/grafana/grafana/pkg/services/apiserver/utils"
	"github.com/grafana/grafana/pkg/services/datasources"
	"github.com/grafana/grafana/pkg/storage/unified/apistore"
)

type Converter struct {
	mapper request.NamespaceMapper
	group  string   // the expected group
	plugin string   // the expected pluginId
	alias  []string // optional alias for the pluginId
}

func NewConverter(mapper request.NamespaceMapper, group string, plugin string, alias []string) *Converter {
	return &Converter{
		mapper: mapper,
		group:  group,
		plugin: plugin,
		alias:  alias,
	}
}

func (r Converter) Mapper() request.NamespaceMapper {
	return r.mapper
}

func (r *Converter) AsDataSource(ds *datasources.DataSource) (*datasourceV0.DataSource, error) {
	if ds.Type != r.plugin && !slices.Contains(r.alias, ds.Type) {
		return nil, fmt.Errorf("expected datasource type: %s %v // not: %s", r.plugin, r.alias, ds.Type)
	}

	obj := &datasourceV0.DataSource{
		ObjectMeta: metav1.ObjectMeta{
			Name:       ds.UID,
			Namespace:  r.mapper(ds.OrgID),
			Generation: int64(ds.Version),
		},
		Spec:   datasourceV0.UnstructuredSpec{},
		Secure: ToInlineSecureValues(ds.UID, maps.Keys(ds.SecureJsonData)),
	}
	obj.UID = gapiutil.CalculateClusterWideUID(obj)
	obj.Spec.SetTitle(ds.Name).
		SetAccess(string(ds.Access)).
		SetURL(ds.URL).
		SetDatabase(ds.Database).
		SetUser(ds.User).
		SetDatabase(ds.Database).
		SetBasicAuth(ds.BasicAuth).
		SetBasicAuthUser(ds.BasicAuthUser).
		SetWithCredentials(ds.WithCredentials).
		SetIsDefault(ds.IsDefault).
		SetReadOnly(ds.ReadOnly)

	if ds.JsonData != nil && !ds.JsonData.IsEmpty() {
		obj.Spec.SetJSONData(ds.JsonData.Interface())
	}

	rv := int64(0)
	if !ds.Created.IsZero() {
		obj.CreationTimestamp = metav1.NewTime(ds.Created)
		rv = ds.Created.UnixMilli()
	}

	// Only mark updated if the times have actually changed
	if !ds.Updated.IsZero() {
		rv = ds.Updated.UnixMilli()
		delta := rv - obj.CreationTimestamp.UnixMilli()
		if delta > 1500 {
			obj.Annotations = map[string]string{
				utils.AnnoKeyUpdatedTimestamp: ds.Updated.UTC().Format(time.RFC3339),
			}
		}
	}

	if rv > 0 {
		obj.ResourceVersion = strconv.FormatInt(rv, 10)
	}

	if ds.APIVersion != "" {
		obj.APIVersion = fmt.Sprintf("%s/%s", r.group, ds.APIVersion)
	}

	if ds.ID > 0 {
		obj.Labels = map[string]string{
			utils.LabelKeyDeprecatedInternalID: strconv.FormatInt(ds.ID, 10),
		}
	}
	return obj, nil
}

// ToInlineSecureValues converts secure json into InlineSecureValues with reference names
// The names are predictable and can be used while we implement dual writing for secrets
func ToInlineSecureValues(dsUID string, keys iter.Seq[string]) common.InlineSecureValues {
	values := make(common.InlineSecureValues)
	for k := range keys {
		values[k] = common.InlineSecureValue{
			Name: GetLegacySecureValueName(dsUID, k),
		}
	}
	if len(values) == 0 {
		return nil
	}
	return values
}

func GetLegacySecureValueName(dsUID string, key string) string {
	h := sha256.New()
	h.Write([]byte(dsUID)) // unique identifier
	h.Write([]byte("|"))
	h.Write([]byte(key)) // property name
	return apistore.LEGACY_DATASOURCE_SECURE_VALUE_NAME_PREFIX + hex.EncodeToString(h.Sum(nil))
}

func (r *Converter) ToAddCommand(ds *datasourceV0.DataSource) (*datasources.AddDataSourceCommand, error) {
	if r.group != "" && ds.APIVersion != "" && !strings.HasPrefix(ds.APIVersion, r.group) {
		return nil, fmt.Errorf("expecting APIGroup: %s", r.group)
	}
	info, err := types.ParseNamespace(ds.Namespace)
	if err != nil {
		return nil, err
	}

	cmd := &datasources.AddDataSourceCommand{
		Name:  ds.Spec.Title(),
		UID:   ds.Name,
		OrgID: info.OrgID,
		Type:  r.plugin,

		Access:          datasources.DsAccess(ds.Spec.Access()),
		URL:             ds.Spec.URL(),
		Database:        ds.Spec.Database(),
		User:            ds.Spec.User(),
		BasicAuth:       ds.Spec.BasicAuth(),
		BasicAuthUser:   ds.Spec.BasicAuthUser(),
		WithCredentials: ds.Spec.WithCredentials(),
		IsDefault:       ds.Spec.IsDefault(),
		ReadOnly:        ds.Spec.ReadOnly(),
	}

	jsonData := ds.Spec.JSONData()
	if jsonData != nil {
		cmd.JsonData = simplejson.NewFromAny(jsonData)
	}

	cmd.SecureJsonData = toSecureJsonData(ds)
	return cmd, nil
}

func (r *Converter) ToUpdateCommand(ds *datasourceV0.DataSource) (*datasources.UpdateDataSourceCommand, error) {
	if r.group != "" && ds.APIVersion != "" && !strings.HasPrefix(ds.APIVersion, r.group) {
		return nil, fmt.Errorf("expecting APIGroup: %s", r.group)
	}
	info, err := types.ParseNamespace(ds.Namespace)
	if err != nil {
		return nil, err
	}

	cmd := &datasources.UpdateDataSourceCommand{
		Name:  ds.Spec.Title(),
		UID:   ds.Name,
		OrgID: info.OrgID,
		Type:  r.plugin,

		Access:          datasources.DsAccess(ds.Spec.Access()),
		URL:             ds.Spec.URL(),
		Database:        ds.Spec.Database(),
		User:            ds.Spec.User(),
		BasicAuth:       ds.Spec.BasicAuth(),
		BasicAuthUser:   ds.Spec.BasicAuthUser(),
		WithCredentials: ds.Spec.WithCredentials(),
		IsDefault:       ds.Spec.IsDefault(),
		ReadOnly:        ds.Spec.ReadOnly(),

		// The only field different than add
		Version: int(ds.Generation),
	}

	jsonData := ds.Spec.JSONData()
	if jsonData != nil {
		cmd.JsonData = simplejson.NewFromAny(jsonData)
	}
	cmd.SecureJsonData = toSecureJsonData(ds)
	return cmd, err
}

func toSecureJsonData(ds *datasourceV0.DataSource) map[string]string {
	if ds == nil || len(ds.Secure) < 1 {
		return nil
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
	return secure
}

func (r Converter) AsLegacyDatasource(ds *datasourceV0.DataSource) (*datasources.DataSource, error) {
	if r.group != "" && ds.APIVersion != "" && !strings.HasPrefix(ds.APIVersion, r.group) {
		return nil, fmt.Errorf("expecting APIGroup: %s", r.group)
	}
	info, err := types.ParseNamespace(ds.Namespace)
	if err != nil {
		return nil, err
	}

	// This is nearly identical to AddDataSourceCommand, except for the SecureJsonData and ID
	legacyDS := &datasources.DataSource{
		Name:  ds.Spec.Title(),
		UID:   ds.Name,
		OrgID: info.OrgID,
		Type:  r.plugin,

		Access:          datasources.DsAccess(ds.Spec.Access()),
		URL:             ds.Spec.URL(),
		Database:        ds.Spec.Database(),
		User:            ds.Spec.User(),
		BasicAuth:       ds.Spec.BasicAuth(),
		BasicAuthUser:   ds.Spec.BasicAuthUser(),
		WithCredentials: ds.Spec.WithCredentials(),
		IsDefault:       ds.Spec.IsDefault(),
		ReadOnly:        ds.Spec.ReadOnly(),
		SecureJsonData:  make(map[string][]byte),
	}

	if ds.Labels != nil {
		if idStr, ok := ds.Labels[utils.LabelKeyDeprecatedInternalID]; ok {
			legacyDS.ID, _ = strconv.ParseInt(idStr, 10, 64)
		}
	}

	if jsonData := ds.Spec.JSONData(); jsonData != nil {
		legacyDS.JsonData = simplejson.NewFromAny(jsonData)
	}

	// Only the keys are exposed, values are never returned
	for k := range ds.Secure {
		legacyDS.SecureJsonData[k] = []byte{}
	}

	return legacyDS, nil
}
