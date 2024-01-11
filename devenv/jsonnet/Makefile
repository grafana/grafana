DASHBOARDS = $(shell find ../dev-dashboards -type f -name '*.json')
TEMPLATES = $(shell find ./ -type f -name '*.tmpl')

dev-dashboards.libsonnet: $(DASHBOARDS) $(TEMPLATES) dev-dashboards.go
	go generate ./
	
main.libsonnet: dev-dashboards.libsonnet
