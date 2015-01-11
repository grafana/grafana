package sqlstore

import (
	//"time"

	"github.com/torkelo/grafana-pro/pkg/bus"
	m "github.com/torkelo/grafana-pro/pkg/models"

	//"github.com/go-xorm/xorm"
)

func init() {
	bus.AddHandler("sql", GetLocations)
	bus.AddHandler("sql", GetLocationByCode)
}

func GetLocationByCode(query *m.GetLocationByCodeQuery) error {
	sess := x.Limit(100, 0).Where("account_id=? AND code=?", query.AccountId, query.Code)
	has, err := sess.Get(&query.Result)

	if !has {
		return m.ErrLocationNotFound
	}
	return err
}

func GetLocations(query *m.GetLocationsQuery) error {
	sess := x.Limit(100, 0).Where("account_id=?", query.AccountId).Asc("name")

	query.Result = make([]*m.Location, 0)
	return sess.Find(&query.Result)
}