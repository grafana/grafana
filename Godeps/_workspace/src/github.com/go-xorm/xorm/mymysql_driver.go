package xorm

import (
	"errors"
	"strings"
	"time"

	"github.com/go-xorm/core"
)

// func init() {
// 	core.RegisterDriver("mymysql", &mymysqlDriver{})
// }

type mymysqlDriver struct {
}

func (p *mymysqlDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	db := &core.Uri{DbType: core.MYSQL}

	pd := strings.SplitN(dataSourceName, "*", 2)
	if len(pd) == 2 {
		// Parse protocol part of URI
		p := strings.SplitN(pd[0], ":", 2)
		if len(p) != 2 {
			return nil, errors.New("Wrong protocol part of URI")
		}
		db.Proto = p[0]
		options := strings.Split(p[1], ",")
		db.Raddr = options[0]
		for _, o := range options[1:] {
			kv := strings.SplitN(o, "=", 2)
			var k, v string
			if len(kv) == 2 {
				k, v = kv[0], kv[1]
			} else {
				k, v = o, "true"
			}
			switch k {
			case "laddr":
				db.Laddr = v
			case "timeout":
				to, err := time.ParseDuration(v)
				if err != nil {
					return nil, err
				}
				db.Timeout = to
			default:
				return nil, errors.New("Unknown option: " + k)
			}
		}
		// Remove protocol part
		pd = pd[1:]
	}
	// Parse database part of URI
	dup := strings.SplitN(pd[0], "/", 3)
	if len(dup) != 3 {
		return nil, errors.New("Wrong database part of URI")
	}
	db.DbName = dup[0]
	db.User = dup[1]
	db.Passwd = dup[2]

	return db, nil
}
