.DEFAULT_GOAL := openapi

API_DIR = definitions
GO_PKG_FILES = $(shell find $(API_DIR) -name *.go -print)
SWAGGER_TAG ?= latest

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
	generate spec -m -o spec.json -i ${HOME}/grafana/pkg/api/docs/tags.json

ensure_go-swagger_mac:
	@hash swagger &>/dev/null || (brew tap go-swagger/go-swagger && brew install go-swagger)

spec-mac: ensure_go-swagger_mac $(GO_PKG_FILES)
	swagger generate spec -m -w $(API_DIR) -o spec.json -i tags.json

.PHONY: openapi
openapi: spec.json
	docker-compose up

clean-spec:
	rm spec.json

clean-containers:
	docker-compose down

client-go:
	docker run --rm \
	--user $$(id -u):$$(id -g) \
	-v $$(pwd)/../../..:${HOME}/grafana \
	swaggerapi/swagger-codegen-cli generate \
	-i ${HOME}/grafana/pkg/api/docs/spec.json \
	-l go \
	-o ${HOME}/grafana/pkg/api/docs/clients/go

client-python:
	docker run --rm \
	--user $$(id -u):$$(id -g) \
	-v $$(pwd)/../../..:${HOME}/grafana \
	swaggerapi/swagger-codegen-cli generate \
	-i ${HOME}/grafana/pkg/api/docs/spec.json \
	-l python \
	-o ${HOME}/grafana/pkg/api/docs/clients/python

clean-clients:
	rm -rf clients/*
