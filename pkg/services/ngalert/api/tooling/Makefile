.DEFAULT_GOAL := openapi

API_DIR = definitions
GO_PKG_FILES = $(shell find $(API_DIR) -name *.go -print)
SWAGGER_TAG ?= latest

PATH_DOWN = pkg/services/ngalert/api/tooling
PATH_UP = ../../../../..

.DEFAULT_GOAL := all

GENERATED_GO_MATCHERS = ./go/*.go

spec.json spec-stable.json: $(GO_PKG_FILES)
	# this is slow because this image does not use the cache
	# https://github.com/go-swagger/go-swagger/blob/v0.27.0/Dockerfile#L5
	docker run --rm -it \
		-w /src/$(PATH_DOWN) \
		-v $$(pwd)/$(PATH_UP):/src \
		--entrypoint sh \
		quay.io/goswagger/swagger:$(SWAGGER_TAG) \
		-c \
		"swagger generate spec -m -o $@; swagger generate spec -m --include-tag=stable -o spec-stable.json"

ensure_go-swagger_mac:
	@hash swagger &>/dev/null || (brew tap go-swagger/go-swagger && brew install go-swagger)

spec.json-mac: ensure_go-swagger_mac $(GO_PKG_FILES)
	swagger generate spec -m -w $(API_DIR) -o spec.json && swagger generate spec -m --include-tag=stable -o ngalert.json

post.json: spec.json
	go run cmd/clean-swagger/main.go -if $(<) -of $@

api.json: spec-stable.json
	go run cmd/clean-swagger/main.go -if $(<) -of $@

swagger-codegen-api:
	docker run --rm -v $$(pwd):/local --user $$(id -u):$$(id -g) swaggerapi/swagger-codegen-cli generate \
	-i /local/post.json \
	-l go-server \
	-Dapis \
	-o /local \
	--additional-properties packageName=api \
	-t /local/swagger-codegen/templates \
	# --import-mappings eval.RelativeTimeRange="github.com/grafana/grafana/pkg/services/ngalert/eval" \
	# --type-mappings RelativeTimeRange=eval.RelativeTimeRange

copy-files:
	ls -1 go | xargs -n 1 -I {} mv go/{} ../generated_base_{}

fix:
	sed -i -e 's/apimodels\.\[\]PostableAlert/apimodels.PostableAlerts/' $(GENERATED_GO_MATCHERS)
	sed -i -e 's/apimodels\.\[\]UpdateDashboardAclCommand/apimodels.Permissions/' $(GENERATED_GO_MATCHERS)
	sed -i -e 's/apimodels\.\[\]PostableApiReceiver/apimodels.TestReceiversConfigParams/' $(GENERATED_GO_MATCHERS)
	goimports -w -v $(GENERATED_GO_MATCHERS)

clean:
	rm -rf ./go

serve: post.json
	docker run --rm -p 80:8080 -v $$(pwd):/tmp -e SWAGGER_FILE=/tmp/$(<) swaggerapi/swagger-editor

serve-stable: api.json
	docker run --rm -p 80:8080 -v $$(pwd):/tmp -e SWAGGER_FILE=/tmp/$(<) swaggerapi/swagger-editor

all: post.json api.json swagger-codegen-api fix copy-files clean
