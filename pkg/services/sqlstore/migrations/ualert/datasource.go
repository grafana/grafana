package ualert

// slurpDSIDs returns a map of [orgID, dataSourceId] -> [UID, Name].
func (m *migration) slurpDSIDs() (map[[2]int64][2]string, error) {
	dsIDs := []struct {
		OrgID int64  `xorm:"org_id"`
		ID    int64  `xorm:"id"`
		UID   string `xorm:"uid"`
		Name  string
	}{}

	err := m.sess.SQL(`SELECT org_id, id, uid, name FROM data_source`).Find(&dsIDs)

	if err != nil {
		return nil, err
	}

	idToUID := make(map[[2]int64][2]string, len(dsIDs))

	for _, ds := range dsIDs {
		idToUID[[2]int64{ds.OrgID, ds.ID}] = [2]string{ds.UID, ds.Name}
	}

	return idToUID, nil
}
