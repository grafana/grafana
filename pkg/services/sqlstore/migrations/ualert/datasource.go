package ualert

// slurpDSIDs returns a map of [orgID, dataSourceId] -> UID.
func (m *migration) slurpDSIDs() (map[[2]int64]string, error) {
	dsIDs := []struct {
		OrgID int64  `xorm:"org_id"`
		ID    int64  `xorm:"id"`
		UID   string `xorm:"uid"`
	}{}

	err := m.sess.SQL(`SELECT org_id, id, uid FROM data_source`).Find(&dsIDs)

	if err != nil {
		return nil, err
	}

	idToUID := make(map[[2]int64]string, len(dsIDs))

	for _, ds := range dsIDs {
		idToUID[[2]int64{ds.OrgID, ds.ID}] = ds.UID
	}

	return idToUID, nil
}
