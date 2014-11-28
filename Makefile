

all: build

build:
	go build ../pkg/cmd/grafana-pro/

setup:
	go get github.com/tools/godep


