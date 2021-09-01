.DEFAULT_GOAL := openapi

API_DIR = definitions
GO_PKG_FILES = $(shell find $(API_DIR) -name *.go -print)
SWAGGER_TAG ?= latest

PATH_DOWN = pkg/services/ngalert/api/tooling
PATH_UP = ../../../../..

spec.json: $(GO_PKG_FILES)
	# this is slow because this image does not use the cache
	# https://github.com/go-swagger/go-swagger/blob/v0.27.0/Dockerfile#L5
	docker run --rm -it \
		-w /src/$(PATH_DOWN) \
		-v $$(pwd)/$(PATH_UP):/src \
		quay.io/goswagger/swagger:$(SWAGGER_TAG) \
		generate spec -m -o $@

ensure_go-swagger_mac:
	@hash swagger &>/dev/null || (brew tap go-swagger/go-swagger && brew install go-swagger)

spec.json-mac: ensure_go-swagger_mac $(GO_PKG_FILES)
	swagger generate spec -m -w $(API_DIR) -o spec.json

post.json: spec.json
	go run cmd/clean-swagger/main.go -if $(<) -of $@

.PHONY: openapi
openapi: post.json
	docker run --rm -p 80:8080 -v $$(pwd):/tmp -e SWAGGER_FILE=/tmp/$(<) swaggerapi/swagger-editor
