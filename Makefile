all: deps build

deps:
	go run build.go setup
	npm install

build:
	go run build.go build
	npm run build

test:
	go test -v ./pkg/...
	npm test

run:
	./bin/grafana-server
