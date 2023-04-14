include ../../.bingo/Variables.mk

DASHBOARDS = $(shell find ../dev-dashboards -type f -name '*.json')
TEMPLATES = $(shell find ./ -type f -name '*.tmpl')

vendor: jsonnetfile.json jsonnetfile.lock.json
	$(JB) install

dev-dashboards.libsonnet: $(DASHBOARDS) $(TEMPLATES) vendor dev-dashboards.go
	go generate ./
	
main.libsonnet: dev-dashboards.libsonnet