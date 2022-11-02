DASHBOARDS = $(shell find ./ -type f -name '*.json')

vendor:
	jb install

gen.libsonnet: $(DASHBOARDS) vendor
	go generate ./gen.go
	
main.libsonnet: gen.libsonnet