DASHBOARDS = $(shell find ./ -type f -name '*.json')

vendor: jsonnetfile.json jsonnetfile.lock.json
	jb install

gen.libsonnet: $(DASHBOARDS) vendor gen.go
	go generate ./gen.go
	
main.libsonnet: gen.libsonnet