.DEFAULT_GOAL := openapi

API_DIR = definitions
GO_PKG_FILES = $(shell find $(API_DIR) -name *.go -print)

spec.json: $(GO_PKG_FILES)
	# this is slow because this image does not use the cache
	# https://github.com/go-swagger/go-swagger/blob/v0.27.0/Dockerfile#L5
	docker run --rm -it -e GOPATH=${GOPATH} -v ${GOPATH}:${GOPATH} -w $$(pwd) go-swagger generate spec -m -o $@

post.json: spec.json
	go run cmd/clean-swagger/main.go -if $(<) -of $@

.PHONY: openapi
openapi: post.json
	docker run --rm -p 80:8080 -v $$(pwd):/tmp -e SWAGGER_FILE=/tmp/$(<) swaggerapi/swagger-editor
