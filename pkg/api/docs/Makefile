.DEFAULT_GOAL := openapi

API_DIR = definitions
GO_PKG_FILES = $(shell find $(API_DIR) -name *.go -print)
SWAGGER_TAG ?= latest
SWAGGER_CODEGEN_TAG ?= latest

spec.json: $(GO_PKG_FILES)
	# this is slow because this image does not use the cache
	# https://github.com/go-swagger/go-swagger/blob/v0.27.0/Dockerfile#L5
	docker run --rm -it \
	-e GOPATH=${HOME}/go:/go \
	-e SWAGGER_GENERATE_EXTENSION=false \
	-v ${HOME}/go:${HOME}/go \
	-v $$(pwd)/../../..:${HOME}/grafana \
	-v $$(pwd)/definitions:/src \
	-w $$(pwd) quay.io/goswagger/swagger:$(SWAGGER_TAG) \
	generate spec -m -o merge/spec.json -i ${HOME}/grafana/pkg/api/docs/tags.json

merge: spec.json
	go run merge/merge_specs.go ../../services/ngalert/api/tooling/post.json

validate: merge
	docker run --rm -it \
	-e GOPATH=${HOME}/go:/go \
	-e SWAGGER_GENERATE_EXTENSION=false \
	-v ${HOME}/go:${HOME}/go \
	-v $$(pwd)/../../..:${HOME}/grafana \
	-v $$(pwd)/definitions:/src \
	-w $$(pwd) quay.io/goswagger/swagger:$(SWAGGER_TAG) \
	validate merged.json

ensure_go-swagger_mac:
	@hash swagger &>/dev/null || (brew tap go-swagger/go-swagger && brew install go-swagger)

spec-mac: ensure_go-swagger_mac $(GO_PKG_FILES)
	swagger generate spec -m -w $(API_DIR) -o merge/spec.json -i tags.json

.PHONY: openapi
openapi: merge
	docker-compose up

clean-spec:
	rm merge/spec.json merged.json

clean-containers:
	docker-compose down

client-go: merge
	docker run --rm \
	-e GOPATH=${HOME}/go:/go \
	--user $$(id -u):$$(id -g) \
	-v ${HOME}/go:${HOME}/go \
	-v $$(pwd)/../../..:${HOME}/grafana \
	swaggerapi/swagger-codegen-cli:$(SWAGGER_CODEGEN_TAG) generate \
	-i ${HOME}/grafana/pkg/api/docs/merged.json \
	-l go \
	--additional-properties packageName=go_client \
	-DdebugOperations \
	-o ${HOME}/grafana/pkg/api/clients/go \
	-t ${HOME}/grafana/pkg/api/docs/templates/go \
	--type-mappings Json=simplejson.Json
	goimports -w -v ../clients/go

client-python: merge
	docker run --rm \
	--user $$(id -u):$$(id -g) \
	-v $$(pwd)/../../..:${HOME}/grafana \
	swaggerapi/swagger-codegen-cli generate \
	-i ${HOME}/grafana/pkg/api/docs/merged.json \
	-l python \
	-o ${HOME}/grafana/pkg/api/clients/python

clean-clients:
	rm -rf ../clients
