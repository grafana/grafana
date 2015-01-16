package xorm

import (
	"errors"
	"strings"

	"github.com/go-xorm/core"
)

// func init() {
// 	core.RegisterDriver("odbc", &odbcDriver{})
// }

type odbcDriver struct {
}

func (p *odbcDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	kv := strings.Split(dataSourceName, ";")
	var dbName string

	for _, c := range kv {
		vv := strings.Split(strings.TrimSpace(c), "=")
		if len(vv) == 2 {
			switch strings.ToLower(vv[0]) {
			case "database":
				dbName = vv[1]
			}
		}
	}
	if dbName == "" {
		return nil, errors.New("no db name provided")
	}
	return &core.Uri{DbName: dbName, DbType: core.MSSQL}, nil
}
