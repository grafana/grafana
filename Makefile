.DEFAULT_GOAL := openapi

PKG_DIR = pkg
GO_PKG_FILES = $(shell find $(PKG_DIR) -name *.go -print)


spec.json: $(GO_PKG_FILES)
	swagger generate spec -m -w $(PKG_DIR) -o $@

.PHONY: openapi
openapi: spec.json
	docker run --rm -p 80:8080 -v $$(pwd):/tmp -e SWAGGER_FILE=/tmp/$(<) swaggerapi/swagger-editor
