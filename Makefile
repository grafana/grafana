

all: build

build:
	go build -o bin/grafana .

setup:
	go get github.com/tools/godep


