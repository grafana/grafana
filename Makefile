-include local/Makefile

all: deps build

deps-go:
	go run build.go setup

deps-js:
	yarn install --pure-lockfile --no-progress

deps: deps-js

build-go:
	go run build.go build

build-server:
	go run build.go build-server

build-cli:
	go run build.go build-cli

build-js:
	yarn run build

build: build-go build-js

test-go:
	go test -v ./pkg/...

test-js:
	yarn test

test: test-go test-js

run:
	./bin/grafana-server

protoc:
	protoc -I pkg/tsdb/models pkg/tsdb/models/*.proto --go_out=plugins=grpc:pkg/tsdb/models/.