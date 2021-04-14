.DEFAULT_GOAL := openapi

API_DIR = pkg/api
GO_PKG_FILES = $(shell find $(API_DIR) -name *.go -print)

spec.json: $(GO_PKG_FILES)
	swagger generate spec -m -w $(API_DIR) -o $@

post.json: spec.json
	go run cmd/clean-swagger/main.go -if $(<) -of $@

.PHONY: openapi
openapi: post.json
	docker run --rm -p 80:8080 -v $$(pwd):/tmp -e SWAGGER_FILE=/tmp/$(<) swaggerapi/swagger-editor
