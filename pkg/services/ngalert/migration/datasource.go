package migration

import (
	"context"

	"github.com/grafana/grafana/pkg/infra/db"
)

type dsUIDLookup map[[2]int64]string

// GetUID fetch thes datasource UID based on orgID+datasourceID
func (d dsUIDLookup) GetUID(orgID, datasourceID int64) string {
	return d[[2]int64{orgID, datasourceID}]
}

// slurpDSIDs returns a map of [orgID, dataSourceId] -> UID.
func (m *migration) slurpDSIDs(ctx context.Context) (dsUIDLookup, error) {
	dsIDs := []struct {
		OrgID int64  `xorm:"org_id"`
		ID    int64  `xorm:"id"`
		UID   string `xorm:"uid"`
	}{}
	err := m.store.WithDbSession(ctx, func(sess *db.Session) error {
		return sess.SQL(`SELECT org_id, id, uid FROM data_source`).Find(&dsIDs)
	})
	if err != nil {
		return nil, err
	}

	idToUID := make(dsUIDLookup, len(dsIDs))

	for _, ds := range dsIDs {
		idToUID[[2]int64{ds.OrgID, ds.ID}] = ds.UID
	}

	return idToUID, nil
}
