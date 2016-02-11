[中文](https://github.com/go-xorm/xorm/blob/master/README_CN.md)

Xorm is a simple and powerful ORM for Go.

[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/go-xorm/xorm?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge)

[![Build Status](https://drone.io/github.com/go-xorm/tests/status.png)](https://drone.io/github.com/go-xorm/tests/latest)  [![Go Walker](http://gowalker.org/api/v1/badge)](http://gowalker.org/github.com/go-xorm/xorm) [![Bitdeli Badge](https://d2weczhvl823v0.cloudfront.net/lunny/xorm/trend.png)](https://bitdeli.com/free "Bitdeli Badge")

# Features

* Struct <-> Table Mapping Support

* Chainable APIs

* Transaction Support

* Both ORM and raw SQL operation Support

* Sync database schema Support

* Query Cache speed up

* Database Reverse support, See [Xorm Tool README](https://github.com/go-xorm/cmd/blob/master/README.md)

* Simple cascade loading support

* Optimistic Locking support


# Drivers Support

Drivers for Go's sql package which currently support database/sql includes:

* Mysql: [github.com/go-sql-driver/mysql](https://github.com/go-sql-driver/mysql)

* MyMysql: [github.com/ziutek/mymysql/godrv](https://github.com/ziutek/mymysql/godrv)

* Postgres: [github.com/lib/pq](https://github.com/lib/pq)

* Tidb: [github.com/pingcap/tidb](https://github.com/pingcap/tidb)

* SQLite: [github.com/mattn/go-sqlite3](https://github.com/mattn/go-sqlite3)

* MsSql: [github.com/denisenkom/go-mssqldb](https://github.com/denisenkom/go-mssqldb)

* MsSql: [github.com/lunny/godbc](https://github.com/lunny/godbc)

* Oracle: [github.com/mattn/go-oci8](https://github.com/mattn/go-oci8) (experiment)

* ql: [github.com/cznic/ql](https://github.com/cznic/ql) (experiment)

# Changelog

* **v0.4.4**
    * ql database expriment support
    * tidb database expriment support
    * sql.NullString and etc. field support
    * select ForUpdate support
    * many bugs fixed

* **v0.4.3**
    * Json column type support
    * oracle expirement support
    * bug fixed

* **v0.4.2**
	* Transaction will auto rollback if not Rollback or Commit be called.
    * Gonic Mapper support
    * bug fixed

[More changelogs ...](https://github.com/go-xorm/manual-en-US/tree/master/chapter-16)

# Installation

If you have [gopm](https://github.com/gpmgo/gopm) installed,

	gopm get github.com/go-xorm/xorm

Or

	go get github.com/go-xorm/xorm

# Documents

* [Manual](http://xorm.io/docs)

* [GoDoc](http://godoc.org/github.com/go-xorm/xorm)

* [GoWalker](http://gowalker.org/github.com/go-xorm/xorm)

# Quick Start

* Create Engine

```Go
engine, err := xorm.NewEngine(driverName, dataSourceName)
```

* Define a struct and Sync2 table struct to database

```Go
type User struct {
    Id int64
    Name string
    Salt string
    Age int
    Passwd string `xorm:"varchar(200)"`
    Created time.Time `xorm:"created"`
    Updated time.Time `xorm:"updated"`
}

err := engine.Sync2(new(User))
```

* Query a SQL string, the returned results is []map[string][]byte

```Go
results, err := engine.Query("select * from user")
```

* Execute a SQL string, the returned results

```Go
affected, err := engine.Exec("update user set age = ? where name = ?", age, name)
```

* Insert one or multipe records to database

```Go
affected, err := engine.Insert(&user)
// INSERT INTO struct () values ()
affected, err := engine.Insert(&user1, &user2)
// INSERT INTO struct1 () values ()
// INSERT INTO struct2 () values ()
affected, err := engine.Insert(&users)
// INSERT INTO struct () values (),(),()
affected, err := engine.Insert(&user1, &users)
// INSERT INTO struct1 () values ()
// INSERT INTO struct2 () values (),(),()
```

* Query one record from database

```Go
has, err := engine.Get(&user)
// SELECT * FROM user LIMIT 1
has, err := engine.Where("name = ?", name).Desc("id").Get(&user)
// SELECT * FROM user WHERE name = ? ORDER BY id DESC LIMIT 1
```

* Query multiple records from database, also you can use join and extends

```Go
var users []User
err := engine.Where("name = ?", name).And("age > 10").Limit(10, 0).Find(&users)
// SELECT * FROM user WHERE name = ? AND age > 10 limit 0 offset 10

type Detail struct {
    Id int64
    UserId int64 `xorm:"index"`
}

type UserDetail struct {
    User `xorm:"extends"`
    Detail `xorm:"extends"`
}

var users []UserDetail
err := engine.Table("user").Select("user.*, detail.*")
    Join("INNER", "detail", "detail.user_id = user.id").
    Where("user.name = ?", name).Limit(10, 0).
    Find(&users)
// SELECT user.*, detail.* FROM user INNER JOIN detail WHERE user.name = ? limit 0 offset 10
```

* Query multiple records and record by record handle, there two methods Iterate and Rows

```Go
err := engine.Iterate(&User{Name:name}, func(idx int, bean interface{}) error {
    user := bean.(*User)
    return nil
})
// SELECT * FROM user

rows, err := engine.Rows(&User{Name:name})
// SELECT * FROM user
defer rows.Close()
bean := new(Struct)
for rows.Next() {
    err = rows.Scan(bean)
}
```

* Update one or more records, default will update non-empty and non-zero fields except to use Cols, AllCols and etc.

```Go
affected, err := engine.Id(1).Update(&user)
// UPDATE user SET ... Where id = ?

affected, err := engine.Update(&user, &User{Name:name})
// UPDATE user SET ... Where name = ?

var ids = []int64{1, 2, 3}
affected, err := engine.In(ids).Update(&user)
// UPDATE user SET ... Where id IN (?, ?, ?)

// force update indicated columns by Cols
affected, err := engine.Id(1).Cols("age").Update(&User{Name:name, Age: 12})
// UPDATE user SET age = ?, updated=? Where id = ?

// force NOT update indicated columns by Omit
affected, err := engine.Id(1).Omit("name").Update(&User{Name:name, Age: 12})
// UPDATE user SET age = ?, updated=? Where id = ?

affected, err := engine.Id(1).AllCols().Update(&user)
// UPDATE user SET name=?,age=?,salt=?,passwd=?,updated=? Where id = ?
```

* Delete one or more records, Delete MUST has conditon

```Go
affected, err := engine.Where(...).Delete(&user)
// DELETE FROM user Where ...
```

* Count records

```Go
counts, err := engine.Count(&user)
// SELECT count(*) AS total FROM user
```

# Cases

* [github.com/m3ng9i/qreader](https://github.com/m3ng9i/qreader)

* [Wego](http://github.com/go-tango/wego)

* [Docker.cn](https://docker.cn/)

* [Gogs](http://try.gogits.org) - [github.com/gogits/gogs](http://github.com/gogits/gogs)

* [Gorevel](http://gorevel.cn/) - [github.com/goofcc/gorevel](http://github.com/goofcc/gorevel)

* [Gowalker](http://gowalker.org) - [github.com/Unknwon/gowalker](http://github.com/Unknwon/gowalker)

* [Gobuild.io](http://gobuild.io) - [github.com/shxsun/gobuild](http://github.com/shxsun/gobuild)

* [Sudo China](http://sudochina.com) - [github.com/insionng/toropress](http://github.com/insionng/toropress)

* [Godaily](http://godaily.org) - [github.com/govc/godaily](http://github.com/govc/godaily)

* [YouGam](http://www.yougam.com/)

* [GoCMS - github.com/zzboy/GoCMS](https://github.com/zzdboy/GoCMS)

* [GoBBS - gobbs.domolo.com](http://gobbs.domolo.com/)

* [go-blog](http://wangcheng.me) - [github.com/easykoo/go-blog](https://github.com/easykoo/go-blog)

# Discuss

Please visit [Xorm on Google Groups](https://groups.google.com/forum/#!forum/xorm)

# Contributing

If you want to pull request, please see [CONTRIBUTING](https://github.com/go-xorm/xorm/blob/master/CONTRIBUTING.md)

# LICENSE

 BSD License
 [http://creativecommons.org/licenses/BSD/](http://creativecommons.org/licenses/BSD/)
