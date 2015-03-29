[中文](https://github.com/go-xorm/xorm/blob/master/README_CN.md)

Xorm is a simple and powerful ORM for Go.

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

* SQLite: [github.com/mattn/go-sqlite3](https://github.com/mattn/go-sqlite3)

* Postgres: [github.com/lib/pq](https://github.com/lib/pq)

* MsSql: [github.com/denisenkom/go-mssqldb](https://github.com/denisenkom/go-mssqldb)

* MsSql: [github.com/lunny/godbc](https://github.com/lunny/godbc)



# Changelog

* **v0.4.1**
	Features:
	* Add deleted xorm tag for soft delete and add unscoped

* **v0.4.0 RC1** 
	Changes:
	* moved xorm cmd to [github.com/go-xorm/cmd](github.com/go-xorm/cmd)
	* refactored general DB operation a core lib at [github.com/go-xorm/core](https://github.com/go-xorm/core)
	* moved tests to github.com/go-xorm/tests [github.com/go-xorm/tests](github.com/go-xorm/tests)

	Improvements:
	* Prepared statement cache
	* Add Incr API
	* Specify Timezone Location

[More changelogs ...](https://github.com/go-xorm/manual-en-US/tree/master/chapter-15)

# Installation

If you have [gopm](https://github.com/gpmgo/gopm) installed, 

	gopm get github.com/go-xorm/xorm

Or

	go get github.com/go-xorm/xorm

# Documents

* [Manual](http://xorm.io/docs)

* [GoDoc](http://godoc.org/github.com/go-xorm/xorm)

* [GoWalker](http://gowalker.org/github.com/go-xorm/xorm)

# Cases

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
