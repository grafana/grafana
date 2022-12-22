module xorm

go 1.19

require (
	github.com/denisenkom/go-mssqldb v0.12.3
	github.com/go-sql-driver/mysql v1.7.0
	github.com/lib/pq v1.10.7
	github.com/mattn/go-sqlite3 v1.14.16
	github.com/stretchr/testify v1.8.1
	github.com/ziutek/mymysql v1.5.4
	xorm.io/builder v0.3.12
	xorm.io/core v0.7.3
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/golang-sql/civil v0.0.0-20190719163853-cb61b32ac6fe // indirect
	github.com/golang-sql/sqlexp v0.1.0 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	golang.org/x/crypto v0.0.0-20220622213112-05595931fe9d // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace xorm.io/core => ./core
