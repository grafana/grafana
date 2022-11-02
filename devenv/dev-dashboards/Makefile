include ../../.bingo/Variables.mk

DASHBOARDS = $(shell find ./ -type f -name '*.json')

vendor: jsonnetfile.json jsonnetfile.lock.json
	$(JB) install

gen.libsonnet: $(DASHBOARDS) vendor gen.go
	go generate ./
	
main.libsonnet: gen.libsonnet