-include local/Makefile

all: deps build

deps-go:
	go run build.go setup

deps-js: node_modules

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

build-docker-dev:
	@echo "\033[92mInfo:\033[0m the frontend code is expected to be built already."
	go run build.go -goos linux -pkg-arch amd64 ${OPT} build pkg-archive latest
	cp dist/grafana-latest.linux-x64.tar.gz packaging/docker
	cd packaging/docker && docker build --tag grafana/grafana:dev .

build-docker-full:
	docker build --tag grafana/grafana:dev .

test-go:
	go test -v ./pkg/...

test-js:
	yarn test

test: test-go test-js

run:
	./bin/grafana-server

clean:
	rm -rf node_modules
	rm -rf public/build

node_modules: package.json yarn.lock
	yarn install --pure-lockfile --no-progress
