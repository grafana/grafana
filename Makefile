all: deps build

deps-go:
	go run build.go setup

deps-js:
	yarn install --pure-lockfile --no-progress

deps: deps-js

build-go:
	go run build.go build

build-js:
	npm run build

build: build-go build-js

test-go:
	go test -v ./pkg/...

test-js:
	npm test

test: test-go test-js

run:
	./bin/grafana-server
