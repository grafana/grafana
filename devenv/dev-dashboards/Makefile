include ../../.bingo/Variables.mk

DASHBOARDS = $(shell find ./ -type f -name '*.json')
TEMPLATES = $(shell find ./ -type f -name '*.tmpl')

vendor: jsonnetfile.json jsonnetfile.lock.json
	$(JB) install

gen.libsonnet: $(DASHBOARDS) $(TEMPLATES) vendor gen.go
	go generate ./
	
main.libsonnet: gen.libsonnet