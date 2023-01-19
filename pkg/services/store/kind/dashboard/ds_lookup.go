package dashboard

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
)

type DataSourceRef struct {
	UID  string `json:"uid,omitempty"`
	Type string `json:"type,omitempty"`
}

type DatasourceLookup interface {
	// ByRef will return the default DS given empty reference (nil ref, or empty ref.uid and ref.type)
	ByRef(ref *DataSourceRef) *DataSourceRef
	ByType(dsType string) []DataSourceRef
}

type DatasourceQueryResult struct {
	UID       string `xorm:"uid"`
	Type      string `xorm:"type"`
	Name      string `xorm:"name"`
	IsDefault bool   `xorm:"is_default"`
}

type directLookup struct{}

func (d *directLookup) ByRef(ref *DataSourceRef) *DataSourceRef {
	if ref == nil {
		return &DataSourceRef{} // indicates the default
	}
	return ref
}

func (d *directLookup) ByType(dsType string) []DataSourceRef {
	return []DataSourceRef{
		{Type: dsType, UID: "*"},
	}
}

func CreateDatasourceLookup(rows []*DatasourceQueryResult) DatasourceLookup {
	byUID := make(map[string]*DataSourceRef, 50)
	byName := make(map[string]*DataSourceRef, 50)
	byType := make(map[string][]DataSourceRef, 50)
	var defaultDS *DataSourceRef

	for _, row := range rows {
		ref := &DataSourceRef{
			UID:  row.UID,
			Type: row.Type,
		}
		byUID[row.UID] = ref
		byName[row.Name] = ref
		if row.IsDefault {
			defaultDS = ref
		}

		if _, ok := byType[row.Type]; !ok {
			byType[row.Type] = make([]DataSourceRef, 0)
		}
		byType[row.Type] = append(byType[row.Type], *ref)
	}

	grafanaDs := &DataSourceRef{
		UID:  "grafana",
		Type: "datasource",
	}
	if defaultDS == nil {
		// fallback replicated from /pkg/api/frontendsettings.go
		// https://github.com/grafana/grafana/blob/7ef21662f9ad74b80d832b9f2aa9db2fb4192741/pkg/api/frontendsettings.go#L51-L56
		defaultDS = grafanaDs
	}

	if _, ok := byUID[grafanaDs.UID]; !ok {
		byUID[grafanaDs.UID] = grafanaDs
	}

	grafanaDsName := "-- Grafana --"
	if _, ok := byName[grafanaDsName]; !ok {
		byName[grafanaDsName] = grafanaDs
	}

	return &DsLookup{
		byName:    byName,
		byUID:     byUID,
		byType:    byType,
		defaultDS: defaultDS,
	}
}

type DsLookup struct {
	byName    map[string]*DataSourceRef
	byUID     map[string]*DataSourceRef
	byType    map[string][]DataSourceRef
	defaultDS *DataSourceRef
}

func (d *DsLookup) ByRef(ref *DataSourceRef) *DataSourceRef {
	if ref == nil {
		return d.defaultDS
	}

	key := ""
	if ref.UID != "" {
		ds, ok := d.byUID[ref.UID]
		if ok {
			return ds
		}
		key = ref.UID
	}
	if key == "" {
		return d.defaultDS
	}
	ds, ok := d.byUID[key]
	if ok {
		return ds
	}

	return d.byName[key]
}

func (d *DsLookup) ByType(dsType string) []DataSourceRef {
	ds, ok := d.byType[dsType]
	if !ok {
		return make([]DataSourceRef, 0)
	}

	return ds
}

func LoadDatasourceLookup(ctx context.Context, orgID int64, sql db.DB) (DatasourceLookup, error) {
	rows := make([]*DatasourceQueryResult, 0)

	if err := sql.WithDbSession(ctx, func(sess *db.Session) error {
		sess.Table("data_source").
			Where("org_id = ?", orgID).
			Cols("uid", "name", "type", "is_default")

		err := sess.Find(&rows)
		if err != nil {
			return err
		}

		return nil
	}); err != nil {
		return nil, err
	}

	return CreateDatasourceLookup(rows), nil
}
