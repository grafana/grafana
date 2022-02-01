SWAGGER_CODEGEN_TAG ?= latest

create-client-dir:
	mkdir ../clients

client-go: create-client-dir
	docker run --rm \
	-e GOPATH=${HOME}/go:/go \
	--user $$(id -u):$$(id -g) \
	-v ${HOME}/go:/go \
	-v $$(pwd)/../../..:/grafana \
	swaggerapi/swagger-codegen-cli:$(SWAGGER_CODEGEN_TAG) generate \
	-i /grafana/public/api-merged.json \
	-l go \
	--additional-properties packageName=go_client \
	-DdebugOperations \
	-o /grafana/pkg/api/clients/go \
	-t /grafana/pkg/api/docs/templates/go \
	--type-mappings Json=simplejson.Json
	goimports -w -v ../clients/go

client-python: create-client-dir
	docker run --rm \
	--user $$(id -u):$$(id -g) \
	-v ${HOME}/go:/go \
	-v $$(pwd)/../../..:/grafana \
	swaggerapi/swagger-codegen-cli generate \
	-i /grafana/public/api-merged.json \
	-l python \
	-o /grafana/pkg/api/clients/python

clean-client-dir:
	rm -rf ../clients
