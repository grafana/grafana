# pq - A pure Go openGauss driver for Go's database/sql package

fork from [github/lib/pq](https://github.com/lib/pq)

## Install

```bash
go get gitee.com/opengauss/openGauss-connector-go-pq
```

## What's the difference of libpq for openGauss

When using original libpq go driver to access openGauss, the following error will be reported.

```text
pq: Invalid username/password,login denied.
```

The reason is that openGauss default user connection password authentication method is sha256, which is a unique encryption method. Although openGauss configuration can be modified by the following methods to support native libpq connection.

1. Set the openGauss initialization parameter password_encryption_type.

    ```sql
    alter system set password_encryption_type=0;
    ```

2. Set pg_hba.conf to allow md5 password verification: host all test 0.0.0.0/0 md5
3. Create a new user in database, then connect by this user.

We still prefer to use a more secure encryption method like sha256, so the modified libpq can be directly compatible with sha256.

## Features

* Adapt openGauss SHA256/SM3 password authentication
* Support for multiple host defined connections
* SSL
  * sslmode
  * sslrootcert
  * sslcert
  * sslkey
  * sslinline      This parameter specifies the sslkey/sslcert is a string not a file
  * sslpassword    This parameter specifies the password for the secret key specified in sslkey
* Handles bad connections for `database/sql`
* Scan `time.Time` correctly (i.e. `timestamp[tz]`, `time[tz]`, `date`)
* Scan binary blobs correctly (i.e. `bytea`)
* Package for `hstore` support
* COPY FROM support
* pq.ParseURL for converting urls to connection strings for sql.Open.
* Many libpq compatible environment variables
* Unix socket support
* Notifications: `LISTEN`/`NOTIFY`
* pgpass support
* GSS (Kerberos) auth

## Multiple Hosts

example [multi_ip](example/multi_ip/multi_ip.go)

postgres docs[LIBPQ-MULTIPLE-HOSTS](https://www.postgresql.org/docs/14/libpq-connect.html#LIBPQ-MULTIPLE-HOSTS)

* Support to define the master and slave addresses at the same time, automatically select the main library connection,
  and automatically connect to the new master library when a switch occurs.
* The target_session_attrs parameter in the connection character can only define read-write (default configuration),
  and there is a problem with the configuration as read-only
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


## Example

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

## Tests

`go test` is used for testing.  See [TESTS.md](TESTS.md) for more details.
