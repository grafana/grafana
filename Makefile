## This is a self-documented Makefile. For usage information, run `make help`:
##
## For more information, refer to https://suva.sh/posts/well-documented-makefiles/

WIRE_TAGS = "oss"

-include local/Makefile
include .bingo/Variables.mk

.PHONY: all deps-go deps-js deps build-go build-server build-cli build-js build build-docker-full build-docker-full-ubuntu lint-go golangci-lint test-go test-js gen-ts test run run-frontend clean devenv devenv-down protobuf drone help

GO = go
GO_FILES ?= ./pkg/...
SH_FILES ?= $(shell find ./scripts -name *.sh)
API_DEFINITION_FILES = $(shell find ./pkg/api/docs/definitions -name '*.go' -print)
SWAGGER_TAG ?= latest
GO_BUILD_FLAGS += $(if $(GO_BUILD_DEV),-dev)
GO_BUILD_FLAGS += $(if $(GO_BUILD_TAGS),-build-tags=$(GO_BUILD_TAGS))

all: deps build

##@ Dependencies

deps-go: ## Install backend dependencies.
	$(GO) run build.go setup

deps-js: node_modules ## Install frontend dependencies.

deps: deps-js ## Install all dependencies.

node_modules: package.json yarn.lock ## Install node modules.
	@echo "install frontend dependencies"
	YARN_ENABLE_PROGRESS_BARS=false yarn install --immutable

##@ Swagger
SPEC_TARGET = public/api-spec.json
MERGED_SPEC_TARGET := public/api-merged.json
NGALERT_SPEC_TARGET = pkg/services/ngalert/api/tooling/post.json

$(SPEC_TARGET): $(API_DEFINITION_FILES) ## Generate API spec
	docker run --rm -it \
	-e GOPATH=${HOME}/go:/go \
	-e SWAGGER_GENERATE_EXTENSION=false \
	-v ${HOME}/go:/go \
	-v $$(pwd):/grafana \
	-w $$(pwd)/pkg/api/docs quay.io/goswagger/swagger:$(SWAGGER_TAG) \
	generate spec -m -o /grafana/public/api-spec.json \
	-w /grafana/pkg/server \
	-x "grafana/grafana/pkg/services/ngalert/api/tooling/definitions" \
	-x "github.com/prometheus/alertmanager" \
	-i /grafana/pkg/api/docs/tags.json

swagger-api-spec: gen-go $(SPEC_TARGET) $(MERGED_SPEC_TARGET)

$(NGALERT_SPEC_TARGET):
	+$(MAKE) -C pkg/services/ngalert/api/tooling post.json

$(MERGED_SPEC_TARGET): $(SPEC_TARGET) $(NGALERT_SPEC_TARGET) ## Merge generated and ngalert API specs
	go run pkg/api/docs/merge/merge_specs.go -o=public/api-merged.json $(<) pkg/services/ngalert/api/tooling/post.json

ensure_go-swagger_mac:
	@hash swagger &>/dev/null || (brew tap go-swagger/go-swagger && brew install go-swagger)

--swagger-api-spec-mac: ensure_go-swagger_mac $(API_DEFINITION_FILES)  ## Generate API spec (for M1 Mac)
	swagger generate spec -m -w pkg/server -o public/api-spec.json \
	-x "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions" \
	-x "github.com/prometheus/alertmanager" \
	-i pkg/api/docs/tags.json

swagger-api-spec-mac: gen-go --swagger-api-spec-mac $(MERGED_SPEC_TARGET)

validate-api-spec: $(MERGED_SPEC_TARGET) ## Validate API spec
	docker run --rm -it \
	-e GOPATH=${HOME}/go:/go \
	-e SWAGGER_GENERATE_EXTENSION=false \
	-v ${HOME}/go:/go \
	-v $$(pwd):/grafana \
	-w $$(pwd)/pkg/api/docs quay.io/goswagger/swagger:$(SWAGGER_TAG) \
	validate /grafana/$(<)

clean-api-spec:
	rm $(SPEC_TARGET) $(MERGED_SPEC_TARGET)

client-go:
	docker run --rm \
	-e GOPATH=${HOME}/go:/go \
	--user $$(id -u):$$(id -g) \
	-v ${HOME}/go:${HOME}/go \
	-v $$(pwd)/:${HOME}/grafana \
	swaggerapi/swagger-codegen-cli generate \
	-i ${HOME}/grafana/public/api-merged.json \
	-l go \
	-DdebugOperations \
	-o ${HOME}/grafana/pkg/api/docs/clients/go \
	-t ${HOME}/grafana/pkg/api/docs/templates/go \
	--type-mappings SaveDashboardCommand=models.SaveDashboardCommand \
	--import-mappings SaveDashboardCommand=models.SaveDashboardCommand \
	--type-mappings AddApiKeyCommand=models.AddApiKeyCommand \
	--import-mappings AddApiKeyCommand=models.AddApiKeyCommand \
	--type-mappings ApiKeyDTO=models.ApiKeyDTO \
	--import-mappings ApiKeyDTO=models.ApiKeyDTO \
	--type-mappings TrimDashboardCommand=models.TrimDashboardCommand \
	--import-mappings TrimDashboardCommand=models.TrimDashboardCommand \
	--type-mappings DashboardTagCloudItem=models.DashboardTagCloudItem \
	--import-mappings DashboardTagCloudItem=models.DashboardTagCloudItem \
	--type-mappings DashboardAclInfoDTO=models.DashboardAclInfoDTO \
	--import-mappings DashboardAclInfoDTO=models.DashboardAclInfoDTO \
	--type-mappings DashboardVersionMeta=models.DashboardVersionMeta \
	--import-mappings DashboardVersionMeta=models.DashboardVersionMeta \
	--type-mappings AddDataSourceCommand=models.AddDataSourceCommand \
	--import-mappings AddDataSourceCommand=models.AddDataSourceCommand \
	--type-mappings UpdateDataSourceCommand=models.UpdateDataSourceCommand \
	--import-mappings UpdateDataSourceCommand=models.UpdateDataSourceCommand \
	--type-mappings CreateFolderCommand=models.CreateFolderCommand \
	--import-mappings CreateFolderCommand=models.CreateFolderCommand \
	--type-mappings UpdateFolderCommand=models.UpdateFolderCommand \
	--import-mappings UpdateFolderCommand=models.UpdateFolderCommand \
	--type-mappings DashboardSnapshotDTO=models.DashboardSnapshotDTO \
	--import-mappings DashboardSnapshotDTO=models.DashboardSnapshotDTO \
	--type-mappings UpdateUserCommand=models.UpdateUserCommand \
	--import-mappings UpdateUserCommand=models.UpdateUserCommand \
	--type-mappings SearchUserQueryResult=models.SearchUserQueryResult \
	--import-mappings SearchUserQueryResult=models.SearchUserQueryResult \
	--type-mappings UserOrgDTO=models.UserOrgDTO \
	--import-mappings UserOrgDTO=models.UserOrgDTO \
	--type-mappings TeamDTO=models.TeamDTO \
	--import-mappings TeamDTO=models.TeamDTO \
	--type-mappings NewApiKeyResult=dtos.NewApiKeyResult \
	--import-mappings NewApiKeyResult=dtos.NewApiKeyResult \
	--type-mappings CalculateDiffTarget=dtos.CalculateDiffTarget \
	--import-mappings CalculateDiffTarget=dtos.CalculateDiffTarget \
	--type-mappings ImportDashboardCommand=dtos.ImportDashboardCommand \
	--import-mappings ImportDashboardCommand=dtos.ImportDashboardCommand \
	--type-mappings DashboardFullWithMeta=dtos.DashboardFullWithMeta \
	--import-mappings DashboardFullWithMeta=dtos.DashboardFullWithMeta \
	--type-mappings TrimDashboardFullWithMeta=dtos.TrimDashboardFullWithMeta \
	--import-mappings TrimDashboardFullWithMeta=dtos.TrimDashboardFullWithMeta \
	--type-mappings DashboardFullWithMeta=dtos.DashboardFullWithMeta \
	--import-mappings DashboardFullWithMeta=dtos.DashboardFullWithMeta \
	--type-mappings DashboardRedirect=dtos.DashboardRedirect \
	--import-mappings DashboardRedirect=dtos.DashboardRedirect \
	--type-mappings DataSourceList=dtos.DataSourceList \
	--import-mappings DataSourceList=dtos.DataSourceList \
	--type-mappings DataSource=dtos.DataSource \
	--import-mappings DataSource=dtos.DataSource \
	--type-mappings FolderSearchHit=dtos.FolderSearchHit \
	--import-mappings FolderSearchHit=dtos.FolderSearchHit \
	--type-mappings Folder=dtos.Folder \
	--import-mappings Folder=dtos.Folder \
	--type-mappings Prefs=dtos.Prefs \
	--import-mappings Prefs=dtos.Prefs \
	--type-mappings CreateDashboardSnapshotCommand=models.CreateDashboardSnapshotCommand \
	--import-mappings CreateDashboardSnapshotCommand=models.CreateDashboardSnapshotCommand \
	--type-mappings DashboardAclUpdateItem=dtos.DashboardAclUpdateItem \
	--import-mappings DashboardAclUpdateItem=dtos.DashboardAclUpdateItem \
	--type-mappings DashboardAclUpdateItem=dtos.DashboardAclUpdateItem \
	--import-mappings DashboardAclUpdateItem=dtos.DashboardAclUpdateItem
	goimports -w -v pkg/api/docs/clients/go

##@ Building

gen-go: $(WIRE)
	@echo "generate go files"
	$(WIRE) gen -tags $(WIRE_TAGS) ./pkg/server ./pkg/cmd/grafana-cli/runner

build-go: $(MERGED_SPEC_TARGET) gen-go ## Build all Go binaries.
	@echo "build go files"
	$(GO) run build.go $(GO_BUILD_FLAGS) build

build-server: ## Build Grafana server.
	@echo "build server"
	$(GO) run build.go $(GO_BUILD_FLAGS) build-server

build-cli: ## Build Grafana CLI application.
	@echo "build grafana-cli"
	$(GO) run build.go $(GO_BUILD_FLAGS) build-cli

build-js: ## Build frontend assets.
	@echo "build frontend"
	yarn run build
	yarn run plugins:build-bundled

build: build-go build-js ## Build backend and frontend.

scripts/go/bin/bra: scripts/go/go.mod
	@cd scripts/go; \
	$(GO) build -o ./bin/bra github.com/unknwon/bra

run: scripts/go/bin/bra ## Build and run web server on filesystem changes.
	@scripts/go/bin/bra run

run-frontend: deps-js ## Fetch js dependencies and watch frontend for rebuild
	yarn start

##@ Testing

test-go: ## Run tests for backend.
	@echo "test backend"
	$(GO) test -v ./pkg/...

test-js: ## Run tests for frontend.
	@echo "test frontend"
	yarn test

test: test-go test-js ## Run all tests.

##@ Linting
scripts/go/bin/golangci-lint: scripts/go/go.mod
	@cd scripts/go; \
	$(GO) build -o ./bin/golangci-lint github.com/golangci/golangci-lint/cmd/golangci-lint

golangci-lint: scripts/go/bin/golangci-lint
	@echo "lint via golangci-lint"
	@scripts/go/bin/golangci-lint run \
		--config ./scripts/go/configs/.golangci.toml \
		$(GO_FILES)

lint-go: golangci-lint ## Run all code checks for backend. You can use GO_FILES to specify exact files to check

# with disabled SC1071 we are ignored some TCL,Expect `/usr/bin/env expect` scripts
shellcheck: $(SH_FILES) ## Run checks for shell scripts.
	@docker run --rm -v "$$PWD:/mnt" koalaman/shellcheck:stable \
	$(SH_FILES) -e SC1071 -e SC2162

##@ Docker

build-docker-full: ## Build Docker image for development.
	@echo "build docker container"
	docker build --tag grafana/grafana:dev .

build-docker-full-ubuntu: ## Build Docker image based on Ubuntu for development.
	@echo "build docker container"
	docker build --tag grafana/grafana:dev-ubuntu -f ./Dockerfile.ubuntu .


##@ Services

# create docker-compose file with provided sources and start them
# example: make devenv sources=postgres,openldap
ifeq ($(sources),)
devenv:
	@printf 'You have to define sources for this command \nexample: make devenv sources=postgres,openldap\n'
else
devenv: devenv-down ## Start optional services, e.g. postgres, prometheus, and elasticsearch.
	$(eval targets := $(shell echo '$(sources)' | tr "," " "))

	@cd devenv; \
	./create_docker_compose.sh $(targets) || \
	(rm -rf {docker-compose.yaml,conf.tmp,.env}; exit 1)

	@cd devenv; \
	docker-compose up -d --build
endif

devenv-down: ## Stop optional services.
	@cd devenv; \
	test -f docker-compose.yaml && \
	docker-compose down || exit 0;

##@ Helpers

# We separate the protobuf generation because most development tasks on
# Grafana do not involve changing protobuf files and protoc is not a
# go-gettable dependency and so getting it installed can be inconvenient.
#
# If you are working on changes to protobuf interfaces you may either use
# this target or run the individual scripts below directly.
protobuf: ## Compile protobuf definitions
	bash scripts/protobuf-check.sh
	bash pkg/plugins/backendplugin/pluginextensionv2/generate.sh

clean: ## Clean up intermediate build artifacts.
	@echo "cleaning"
	rm -rf node_modules
	rm -rf public/build

gen-ts:
	@echo "generating TypeScript definitions"
	go get github.com/tkrajina/typescriptify-golang-structs/typescriptify@v0.1.7
	tscriptify -interface -package=github.com/grafana/grafana/pkg/services/live/pipeline -import="import { FieldConfig } from '@grafana/data'" -target=public/app/features/live/pipeline/models.gen.ts pkg/services/live/pipeline/config.go
	go mod tidy

# This repository's configuration is protected (https://readme.drone.io/signature/).
# Use this make target to regenerate the configuration YAML files when
# you modify starlark files.
drone: $(DRONE)
	$(DRONE) starlark --format
	$(DRONE) lint .drone.yml --trusted
	$(DRONE) --server https://drone.grafana.net sign --save grafana/grafana

help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
