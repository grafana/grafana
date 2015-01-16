package xorm

import (
	"errors"
	"fmt"
	"net/url"
	"sort"
	"strings"

	"github.com/go-xorm/core"
)

// func init() {
// 	core.RegisterDriver("postgres", &pqDriver{})
// }

type pqDriver struct {
}

type values map[string]string

func (vs values) Set(k, v string) {
	vs[k] = v
}

func (vs values) Get(k string) (v string) {
	return vs[k]
}

func errorf(s string, args ...interface{}) {
	panic(fmt.Errorf("pq: %s", fmt.Sprintf(s, args...)))
}

func parseURL(connstr string) (string, error) {
	u, err := url.Parse(connstr)
	if err != nil {
		return "", err
	}

	if u.Scheme != "postgres" {
		return "", fmt.Errorf("invalid connection protocol: %s", u.Scheme)
	}

	var kvs []string
	escaper := strings.NewReplacer(` `, `\ `, `'`, `\'`, `\`, `\\`)
	accrue := func(k, v string) {
		if v != "" {
			kvs = append(kvs, k+"="+escaper.Replace(v))
		}
	}

	if u.User != nil {
		v := u.User.Username()
		accrue("user", v)

		v, _ = u.User.Password()
		accrue("password", v)
	}

	i := strings.Index(u.Host, ":")
	if i < 0 {
		accrue("host", u.Host)
	} else {
		accrue("host", u.Host[:i])
		accrue("port", u.Host[i+1:])
	}

	if u.Path != "" {
		accrue("dbname", u.Path[1:])
	}

	q := u.Query()
	for k := range q {
		accrue(k, q.Get(k))
	}

	sort.Strings(kvs) // Makes testing easier (not a performance concern)
	return strings.Join(kvs, " "), nil
}

func parseOpts(name string, o values) {
	if len(name) == 0 {
		return
	}

	name = strings.TrimSpace(name)

	ps := strings.Split(name, " ")
	for _, p := range ps {
		kv := strings.Split(p, "=")
		if len(kv) < 2 {
			errorf("invalid option: %q", p)
		}
		o.Set(kv[0], kv[1])
	}
}

func (p *pqDriver) Parse(driverName, dataSourceName string) (*core.Uri, error) {
	db := &core.Uri{DbType: core.POSTGRES}
	o := make(values)
	var err error
	if strings.HasPrefix(dataSourceName, "postgres://") {
		dataSourceName, err = parseURL(dataSourceName)
		if err != nil {
			return nil, err
		}
	}
	parseOpts(dataSourceName, o)

	db.DbName = o.Get("dbname")
	if db.DbName == "" {
		return nil, errors.New("dbname is empty")
	}
	return db, nil
}
