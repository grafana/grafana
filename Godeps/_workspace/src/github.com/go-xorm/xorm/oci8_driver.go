package xorm

import (
	"errors"
	"regexp"

	"github.com/go-xorm/core"
)

// func init() {
// 	core.RegisterDriver("oci8", &oci8Driver{})
// }

type oci8Driver struct {
}

//dataSourceName=user/password@ipv4:port/dbname
//dataSourceName=user/password@[ipv6]:port/dbname
func (p *oci8Driver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	db := &core.Uri{DbType: core.ORACLE}
	dsnPattern := regexp.MustCompile(
		`^(?P<user>.*)\/(?P<password>.*)@` + // user:password@
			`(?P<net>.*)` + // ip:port
			`\/(?P<dbname>.*)`) // dbname
	matches := dsnPattern.FindStringSubmatch(dataSourceName)
	names := dsnPattern.SubexpNames()
	for i, match := range matches {
		switch names[i] {
		case "dbname":
			db.DbName = match
		}
	}
	if db.DbName == "" {
		return nil, errors.New("dbname is empty")
	}
	return db, nil
}
