-include local/Makefile

.PHONY: all deps-go deps-js deps build-go build-server build-cli build-js build build-docker-dev build-docker-full lint-go test-go test-js test run clean

all: deps build

deps-go:
	go run build.go setup

deps-js: node_modules

deps: deps-js

build-go:
	@echo "build go files"
	go run build.go build

build-server:
	@echo "build server"
	go run build.go build-server

build-cli:
	@echo "build in CI environment"
	go run build.go build-cli

build-js:
	@echo "build frontend"
	yarn run build

build: build-go build-js

build-docker-dev:
	@echo "build development container"
	@echo "\033[92mInfo:\033[0m the frontend code is expected to be built already."
	go run build.go -goos linux -pkg-arch amd64 ${OPT} build pkg-archive latest
	cp dist/grafana-latest.linux-x64.tar.gz packaging/docker
	cd packaging/docker && docker build --tag grafana/grafana:dev .

build-docker-full:
	@echo "build docker container"
	docker build --tag grafana/grafana:dev .

lint-go:
	@echo "lint go source"
	scripts/backend-lint.sh

test-go:
	@echo "test backend"
	go test -v ./pkg/...

test-js:
	@echo "test frontend"
	yarn test

test: test-go test-js

run:
	@echo "start a server"
	./bin/grafana-server

clean:
	@echo "cleaning"
	rm -rf node_modules
	rm -rf public/build

node_modules: package.json yarn.lock
	@echo "install frontend dependencies"
	yarn install --pure-lockfile --no-progress
