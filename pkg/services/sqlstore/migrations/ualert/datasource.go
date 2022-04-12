package ualert

type dsUIDLookup map[[2]int64]dsLookupValue

type dsLookupValue struct {
	UID  string
	Type string
}

// Get fetch the dsLookupValue based on orgID+datasourceID
func (d dsUIDLookup) Get(orgID, datasourceID int64) dsLookupValue {
	return d[[2]int64{orgID, datasourceID}]
}

// slurpDSIDs returns a map of [orgID, dataSourceId] -> UID.
func (m *migration) slurpDSIDs() (dsUIDLookup, error) {
	var dsIDs []struct {
		OrgID int64  `xorm:"org_id"`
		ID    int64  `xorm:"id"`
		UID   string `xorm:"uid"`
		Type  string `xorm:"type"`
	}

	err := m.sess.SQL(`SELECT org_id, id, uid, type FROM data_source`).Find(&dsIDs)

	if err != nil {
		return nil, err
	}

	idToUID := make(dsUIDLookup, len(dsIDs))

	for _, ds := range dsIDs {
		idToUID[[2]int64{ds.OrgID, ds.ID}] = dsLookupValue{
			UID:  ds.UID,
			Type: ds.Type,
		}
	}

	return idToUID, nil
}
