// Copyright 2015 The Xorm Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package xorm

import (
	"errors"
	"regexp"

	"github.com/go-xorm/core"
)

// func init() {
// 	core.RegisterDriver("goracle", &goracleDriver{})
// }

type goracleDriver struct {
}

func (cfg *goracleDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	db := &core.Uri{DbType: core.ORACLE}
	dsnPattern := regexp.MustCompile(
		`^(?:(?P<user>.*?)(?::(?P<passwd>.*))?@)?` + // [user[:password]@]
			`(?:(?P<net>[^\(]*)(?:\((?P<addr>[^\)]*)\))?)?` + // [net[(addr)]]
			`\/(?P<dbname>.*?)` + // /dbname
			`(?:\?(?P<params>[^\?]*))?$`) // [?param1=value1&paramN=valueN]
	matches := dsnPattern.FindStringSubmatch(dataSourceName)
	//tlsConfigRegister := make(map[string]*tls.Config)
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
