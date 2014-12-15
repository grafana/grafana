package xorm

import (
	"regexp"
	"strings"

	"github.com/go-xorm/core"
)

// func init() {
// 	core.RegisterDriver("mysql", &mysqlDriver{})
// }

type mysqlDriver struct {
}

func (p *mysqlDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	dsnPattern := regexp.MustCompile(
		`^(?:(?P<user>.*?)(?::(?P<passwd>.*))?@)?` + // [user[:password]@]
			`(?:(?P<net>[^\(]*)(?:\((?P<addr>[^\)]*)\))?)?` + // [net[(addr)]]
			`\/(?P<dbname>.*?)` + // /dbname
			`(?:\?(?P<params>[^\?]*))?$`) // [?param1=value1&paramN=valueN]
	matches := dsnPattern.FindStringSubmatch(dataSourceName)
	//tlsConfigRegister := make(map[string]*tls.Config)
	names := dsnPattern.SubexpNames()

	uri := &core.Uri{DbType: core.MYSQL}

	for i, match := range matches {
		switch names[i] {
		case "dbname":
			uri.DbName = match
		case "params":
			if len(match) > 0 {
				kvs := strings.Split(match, "&")
				for _, kv := range kvs {
					splits := strings.Split(kv, "=")
					if len(splits) == 2 {
						switch splits[0] {
						case "charset":
							uri.Charset = splits[1]
						}
					}
				}
			}

		}
	}
	return uri, nil
}
