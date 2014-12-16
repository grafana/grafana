

all: build

build:
	go build -o bin/grafana .
	go test ./pkg/...

lint:
	@gofmt -w . && go tool vet pkg/**/*.go && echo "$(GOLINT)"

setup:
	go get github.com/tools/godep
	go install github.com/mattn/go-sqlite3




