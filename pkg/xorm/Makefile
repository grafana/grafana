IMPORT := xorm.io/xorm
export GO111MODULE=on

GO ?= go
GOFMT ?= gofmt -s
TAGS ?=
SED_INPLACE := sed -i

GOFILES := $(shell find . -name "*.go" -type f)

PACKAGES ?= $(shell GO111MODULE=on $(GO) list ./...)

TEST_MSSQL_HOST ?= mssql:1433
TEST_MSSQL_DBNAME ?= gitea
TEST_MSSQL_USERNAME ?= sa
TEST_MSSQL_PASSWORD ?= MwantsaSecurePassword1

TEST_MYSQL_HOST ?= mysql:3306
TEST_MYSQL_CHARSET ?= utf8
TEST_MYSQL_DBNAME ?= xorm_test
TEST_MYSQL_USERNAME ?= root
TEST_MYSQL_PASSWORD ?=

TEST_PGSQL_HOST ?= pgsql:5432
TEST_PGSQL_SCHEMA ?=
TEST_PGSQL_DBNAME ?= xorm_test
TEST_PGSQL_USERNAME ?= postgres
TEST_PGSQL_PASSWORD ?= mysecretpassword

TEST_TIDB_HOST ?= tidb:4000
TEST_TIDB_DBNAME ?= xorm_test
TEST_TIDB_USERNAME ?= root
TEST_TIDB_PASSWORD ?=

TEST_CACHE_ENABLE ?= false

.PHONY: all
all: build

.PHONY: build
build: go-check $(GO_SOURCES)
	$(GO) build

.PHONY: clean
clean:
	$(GO) clean -i ./...
	rm -rf *.sql *.log test.db *coverage.out coverage.all

.PHONY: coverage
coverage:
	@hash gocovmerge > /dev/null 2>&1; if [ $$? -ne 0 ]; then \
		$(GO) get -u github.com/wadey/gocovmerge; \
	fi
	gocovmerge $(shell find . -type f -name "coverage.out") > coverage.all;\

.PHONY: fmt
fmt:
	$(GOFMT) -w $(GOFILES)

.PHONY: fmt-check
fmt-check:
	# get all go files and run go fmt on them
	@diff=$$($(GOFMT) -d $(GOFILES)); \
	if [ -n "$$diff" ]; then \
		echo "Please run 'make fmt' and commit the result:"; \
		echo "$${diff}"; \
		exit 1; \
	fi;

.PHONY: go-check
go-check:
	$(eval GO_VERSION := $(shell printf "%03d%03d%03d" $(shell go version | grep -Eo '[0-9]+\.?[0-9]+?\.?[0-9]?\s' | tr '.' ' ');))
	@if [ "$(GO_VERSION)" -lt "001011000" ]; then \
		echo "Gitea requires Go 1.11.0 or greater to build. You can get it at https://golang.org/dl/"; \
		exit 1; \
	fi

.PHONY: help
help:
	@echo "Make Routines:"
	@echo " -                   equivalent to \"build\""
	@echo " - build             creates the entire project"
	@echo " - clean             delete integration files and build files but not css and js files"
	@echo " - fmt               format the code"
	@echo " - lint            	run code linter revive"
	@echo " - misspell          check if a word is written wrong"
	@echo " - test       		run default unit test"
	@echo " - test-sqlite       run unit test for sqlite"
	@echo " - vet               examines Go source code and reports suspicious constructs"

.PHONY: lint
lint: revive

.PHONY: revive
revive:
	@hash revive > /dev/null 2>&1; if [ $$? -ne 0 ]; then \
		$(GO) get -u github.com/mgechev/revive; \
	fi
	revive -config .revive.toml -exclude=./vendor/... ./... || exit 1

.PHONY: misspell
misspell:
	@hash misspell > /dev/null 2>&1; if [ $$? -ne 0 ]; then \
		$(GO) get -u github.com/client9/misspell/cmd/misspell; \
	fi
	misspell -w -i unknwon $(GOFILES)

.PHONY: misspell-check
misspell-check:
	@hash misspell > /dev/null 2>&1; if [ $$? -ne 0 ]; then \
		$(GO) get -u github.com/client9/misspell/cmd/misspell; \
	fi
	misspell -error -i unknwon,destory $(GOFILES)

.PHONY: test
test: test-sqlite

.PNONY: test-mymysql
test-mymysql: go-check
	$(GO) test -v -race -db=mymysql -cache=$(TEST_CACHE_ENABLE) \
	-conn_str="tcp:$(TEST_MYSQL_HOST)*$(TEST_MYSQL_DBNAME)/$(TEST_MYSQL_USERNAME)/$(TEST_MYSQL_PASSWORD)" \
	-coverprofile=mymysql.$(TEST_CACHE_ENABLE).coverage.out -covermode=atomic

.PNONY: test-mymysql\#%
test-mymysql\#%: go-check
	$(GO) test -v -race -run $* -db=mymysql -cache=$(TEST_CACHE_ENABLE) \
	-conn_str="tcp:$(TEST_MYSQL_HOST)*$(TEST_MYSQL_DBNAME)/$(TEST_MYSQL_USERNAME)/$(TEST_MYSQL_PASSWORD)" \
	-coverprofile=mymysql.$(TEST_CACHE_ENABLE).coverage.out -covermode=atomic

.PNONY: test-mysql
test-mysql: go-check
	$(GO) test -v -race -db=mysql -cache=$(TEST_CACHE_ENABLE) \
	-conn_str="$(TEST_MYSQL_USERNAME):$(TEST_MYSQL_PASSWORD)@tcp($(TEST_MYSQL_HOST))/$(TEST_MYSQL_DBNAME)?charset=$(TEST_MYSQL_CHARSET)" \
	-coverprofile=mysql.$(TEST_CACHE_ENABLE).coverage.out -covermode=atomic

.PHONY: test-mysql\#%
test-mysql\#%: go-check
	$(GO) test -v -race -run $* -db=mysql -cache=$(TEST_CACHE_ENABLE) \
	-conn_str="$(TEST_MYSQL_USERNAME):$(TEST_MYSQL_PASSWORD)@tcp($(TEST_MYSQL_HOST))/$(TEST_MYSQL_DBNAME)?charset=$(TEST_MYSQL_CHARSET)" \
	-coverprofile=mysql.$(TEST_CACHE_ENABLE).coverage.out -covermode=atomic

.PNONY: test-postgres
test-postgres: go-check
	$(GO) test -v -race -db=postgres -schema='$(TEST_PGSQL_SCHEMA)' -cache=$(TEST_CACHE_ENABLE) \
	-conn_str="postgres://$(TEST_PGSQL_USERNAME):$(TEST_PGSQL_PASSWORD)@$(TEST_PGSQL_HOST)/$(TEST_PGSQL_DBNAME)?sslmode=disable" \
	-coverprofile=postgres.$(TEST_CACHE_ENABLE).coverage.out -covermode=atomic

.PHONY: test-postgres\#%
test-postgres\#%: go-check
	$(GO) test -v -race -run $* -db=postgres -schema='$(TEST_PGSQL_SCHEMA)' -cache=$(TEST_CACHE_ENABLE) \
	-conn_str="postgres://$(TEST_PGSQL_USERNAME):$(TEST_PGSQL_PASSWORD)@$(TEST_PGSQL_HOST)/$(TEST_PGSQL_DBNAME)?sslmode=disable" \
	-coverprofile=postgres.$(TEST_CACHE_ENABLE).coverage.out -covermode=atomic

.PHONY: test-sqlite
test-sqlite: go-check
	$(GO) test -v -race -cache=$(TEST_CACHE_ENABLE) -db=sqlite3 -conn_str="./test.db?cache=shared&mode=rwc" \
	-coverprofile=sqlite.$(TEST_CACHE_ENABLE).coverage.out -covermode=atomic

.PHONY: test-sqlite\#%
test-sqlite\#%: go-check
	$(GO) test -v -race -run $* -cache=$(TEST_CACHE_ENABLE) -db=sqlite3 -conn_str="./test.db?cache=shared&mode=rwc" \
	-coverprofile=sqlite.$(TEST_CACHE_ENABLE).coverage.out -covermode=atomic

.PHONY: vet
vet:
	$(GO) vet $(PACKAGES)