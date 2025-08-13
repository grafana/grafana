# pq - 用于Go数据库/sql包的Go openGauss驱动程序

fork from [github/lib/pq](https://github.com/lib/pq)

## 安装

```bash
go get gitee.com/opengauss/openGauss-connector-go-pq
```

## openGauss版libpq差异

使用原生libpq go驱动程序访问openGauss时，会报以下错误。

```text
pq: Invalid username/password,login denied.
```

因为openGauss默认的用户连接密码认证方法是sha256，这是唯一的加密方法。 openGauss配置经以下几种方法修改后支持原生libpq连接。

1. 设置openGauss初始化参数password_encryption_type。

    ```sql
    alter system set password_encryption_type=0;
    ```

2. 设置pg_hba.conf以允许md5密码验证：host all test 0.0.0.0/0 md5。

3. 在数据库中创建新用户，然后通过此用户连接。

不过，我们仍然更倾向使用像sha256这样更安全的加密方法，修改后的libpq可以直接兼容sha256。

## 特性

* 适配openGauss SHA256/SM3 密码认证
* 支持连接字符串多host定义
* SSL
  * sslmode
  * sslrootcert
  * sslcert
  * sslkey
  * sslinline      指定sslkey/sslcert是字符串,而不是文件名
  * sslpassword    指定sslkey密码短语
* 处理`database/sql`坏连接
* 正确扫描`time.Time`（即`timestamp[tz]`, `time[tz]`, `date`）
* 正确扫描二进制Blob（即`bytea`）
* 支持`hstore`软件包
* 支持COPY FROM
* pq.ParseURL用于将URL转换为sql.Open的连接字符串。
* libpq兼容的环境变量
* 支持Unix套接字
* 通知：`LISTEN`/`NOTIFY`
* 支持pgpass
* GSS（Kerberos）验证

## Multiple Hosts

示例[multi_ip](example/multi_ip/multi_ip.go)

postgres 介绍文档[LIBPQ-MULTIPLE-HOSTS](https://www.postgresql.org/docs/14/libpq-connect.html#LIBPQ-MULTIPLE-HOSTS)

* 支持同时定义主从地址,自动选择主库连接,当发生切换事自动连接新当主库.
* 连接字符中target_session_attrs参数暂时只能定义read-write(默认配置),配置为read-only存在问题
* target_session_attrs
  - any (default)
  - read-write
  - read-only
  - primary
  - standby
  - prefer-standby

```text
postgres://gaussdb:secret@foo,bar,baz/mydb?sslmode=disable&target_session_attrs=primary&connect_timeout=1
postgres://gaussdb:secret@foo:1,bar:2,baz:3/mydb?sslmode=disable&target_session_attrs=primary&connect_timeout=1
user=gaussdb password=secret host=foo,bar,baz port=5432 dbname=mydb sslmode=disable target_session_attrs=primary connect_timeout=1
user=gaussdb password=secret host=foo,bar,baz port=5432,5432,5433 dbname=mydb sslmode=disable target_session_attrs=primary connect_timeout=1
```

## 示例

```go
import (
 "database/sql"

 _ "gitee.com/opengauss/openGauss-connector-go-pq"
)

func main() {
 connStr := "host=127.0.0.1 port=5432 user=gaussdb password=test@1234 dbname=postgres sslmode=disable"
 db, err := sql.Open("opengauss", connStr)
 if err != nil {
  log.Fatal(err)
 }
 var date string
 err = db.QueryRow("select current_date ").Scan(&date)
 if err != nil {
  log.Fatal(err)
 }
 fmt.Println(date)
}
```

## 测试

`go test`适用于测试。 有关更多详细信息，请参见[测试.md](TESTS.md)。
