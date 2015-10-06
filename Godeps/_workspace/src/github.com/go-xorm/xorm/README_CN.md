# xorm

[English](https://github.com/go-xorm/xorm/blob/master/README.md)

xorm是一个简单而强大的Go语言ORM库. 通过它可以使数据库操作非常简便。

[![Build Status](https://drone.io/github.com/go-xorm/tests/status.png)](https://drone.io/github.com/go-xorm/tests/latest)  [![Go Walker](http://gowalker.org/api/v1/badge)](http://gowalker.org/github.com/go-xorm/xorm)

## 特性

* 支持Struct和数据库表之间的灵活映射，并支持自动同步

* 事务支持

* 同时支持原始SQL语句和ORM操作的混合执行

* 使用连写来简化调用

* 支持使用Id, In, Where, Limit, Join, Having, Table, Sql, Cols等函数和结构体等方式作为条件

* 支持级联加载Struct 

* 支持缓存

* 支持根据数据库自动生成xorm的结构体

* 支持记录版本（即乐观锁）

## 驱动支持

目前支持的Go数据库驱动和对应的数据库如下：

* Mysql: [github.com/go-sql-driver/mysql](https://github.com/go-sql-driver/mysql)

* MyMysql: [github.com/ziutek/mymysql/godrv](https://github.com/ziutek/mymysql/godrv)

* SQLite: [github.com/mattn/go-sqlite3](https://github.com/mattn/go-sqlite3)

* Postgres: [github.com/lib/pq](https://github.com/lib/pq)

* MsSql: [github.com/denisenkom/go-mssqldb](https://github.com/denisenkom/go-mssqldb)

* MsSql: [github.com/lunny/godbc](https://github.com/lunny/godbc)

## 更新日志

* **v0.4.2**
	新特性：
	* deleted标记
	* bug fixed

[更多更新日志...](https://github.com/go-xorm/manual-zh-CN/tree/master/chapter-16)

## 安装

推荐使用 [gopm](https://github.com/gpmgo/gopm) 进行安装： 

	gopm get github.com/go-xorm/xorm
	
或者您也可以使用go工具进行安装：

	go get github.com/go-xorm/xorm

## 文档

* [操作指南](http://xorm.io/docs)

* [GoWalker代码文档](http://gowalker.org/github.com/go-xorm/xorm)

* [Godoc代码文档](http://godoc.org/github.com/go-xorm/xorm)


## 案例

* [Wego](http://github.com/go-tango/wego)

* [Docker.cn](https://docker.cn/)

* [Gogs](http://try.gogits.org) - [github.com/gogits/gogs](http://github.com/gogits/gogs)

* [Gowalker](http://gowalker.org) - [github.com/Unknwon/gowalker](http://github.com/Unknwon/gowalker)

* [Gobuild.io](http://gobuild.io) - [github.com/shxsun/gobuild](http://github.com/shxsun/gobuild)

* [Sudo China](http://sudochina.com) - [github.com/insionng/toropress](http://github.com/insionng/toropress)

* [Godaily](http://godaily.org) - [github.com/govc/godaily](http://github.com/govc/godaily)

* [YouGam](http://www.yougam.com/)

* [GoCMS - github.com/zzboy/GoCMS](https://github.com/zzdboy/GoCMS)

* [GoBBS - gobbs.domolo.com](http://gobbs.domolo.com/)

* [go-blog](http://wangcheng.me) - [github.com/easykoo/go-blog](https://github.com/easykoo/go-blog)

## 讨论

请加入QQ群：280360085 进行讨论。

## 贡献

如果您也想为Xorm贡献您的力量，请查看 [CONTRIBUTING](https://github.com/go-xorm/xorm/blob/master/CONTRIBUTING.md)

## LICENSE

BSD License
[http://creativecommons.org/licenses/BSD/](http://creativecommons.org/licenses/BSD/)
