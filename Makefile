## This is a self-documented Makefile. For usage information, run `make help`:
##
## For more information, refer to https://suva.sh/posts/well-documented-makefiles/

WIRE_TAGS = "oss"

-include local/Makefile
include .bingo/Variables.mk

GO = go
GO_VERSION = 1.23.1
GO_LINT_FILES ?= $(shell ./scripts/go-workspace/golangci-lint-includes.sh)
GO_TEST_FILES ?= $(shell ./scripts/go-workspace/test-includes.sh)
SH_FILES ?= $(shell find ./scripts -name *.sh)
GO_RACE  := $(shell [ -n "$(GO_RACE)" -o -e ".go-race-enabled-locally" ] && echo 1 )
GO_RACE_FLAG := $(if $(GO_RACE),-race)
GO_BUILD_FLAGS += $(if $(GO_BUILD_DEV),-dev)
GO_BUILD_FLAGS += $(if $(GO_BUILD_TAGS),-build-tags=$(GO_BUILD_TAGS))
GO_BUILD_FLAGS += $(GO_RACE_FLAG)
GIT_BASE = remotes/origin/main

# GNU xargs has flag -r, and BSD xargs (e.g. MacOS) has that behaviour by default
XARGSR = $(shell xargs --version 2>&1 | grep -q GNU && echo xargs -r || echo xargs)

targets := $(shell echo '$(sources)' | tr "," " ")

GO_INTEGRATION_TESTS := $(shell find ./pkg -type f -name '*_test.go' -exec grep -l '^func TestIntegration' '{}' '+' | grep -o '\(.*\)/' | sort -u)

.PHONY: all
all: deps build

##@ Dependencies

.PHONY: deps-go
deps-go: ## Install backend dependencies.
	$(GO) run $(GO_RACE_FLAG) build.go setup

.PHONY: deps-js
deps-js: node_modules ## Install frontend dependencies.

.PHONY: deps
deps: deps-js ## Install all dependencies.

.PHONY: node_modules
node_modules: package.json yarn.lock ## Install node modules.
	@echo "install frontend dependencies"
	YARN_ENABLE_PROGRESS_BARS=false yarn install --immutable

##@ Swagger
SPEC_TARGET = public/api-spec.json
ENTERPRISE_SPEC_TARGET = public/api-enterprise-spec.json
MERGED_SPEC_TARGET = public/api-merged.json
NGALERT_SPEC_TARGET = pkg/services/ngalert/api/tooling/api.json

$(NGALERT_SPEC_TARGET):
	+$(MAKE) -C pkg/services/ngalert/api/tooling api.json

$(MERGED_SPEC_TARGET): swagger-oss-gen swagger-enterprise-gen $(NGALERT_SPEC_TARGET) $(SWAGGER) ## Merge generated and ngalert API specs
	# known conflicts DsPermissionType, AddApiKeyCommand, Json, Duration (identical models referenced by both specs)
	$(SWAGGER) mixin -q $(SPEC_TARGET) $(ENTERPRISE_SPEC_TARGET) $(NGALERT_SPEC_TARGET) --ignore-conflicts -o $(MERGED_SPEC_TARGET)

.PHONY: swagger-oss-gen
swagger-oss-gen: $(SWAGGER) ## Generate API Swagger specification
	@echo "re-generating swagger for OSS"
	rm -f $(SPEC_TARGET)
	SWAGGER_GENERATE_EXTENSION=false $(SWAGGER) generate spec -q -m -w pkg/server -o $(SPEC_TARGET) \
	-x "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions" \
	-x "github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2/options" \
	-x "github.com/prometheus/alertmanager" \
	-i pkg/api/swagger_tags.json \
	--exclude-tag=alpha \
	--exclude-tag=enterprise

# this file only exists if enterprise is enabled
.PHONY: swagger-enterprise-gen
ENTERPRISE_EXT_FILE = pkg/extensions/ext.go
ifeq ("$(wildcard $(ENTERPRISE_EXT_FILE))","") ## if enterprise is not enabled
swagger-enterprise-gen:
	@echo "skipping re-generating swagger for enterprise: not enabled"
else
swagger-enterprise-gen: $(SWAGGER) ## Generate API Swagger specification
	@echo "re-generating swagger for enterprise"
	rm -f $(ENTERPRISE_SPEC_TARGET)
	SWAGGER_GENERATE_EXTENSION=false $(SWAGGER) generate spec -q -m -w pkg/server -o $(ENTERPRISE_SPEC_TARGET) \
	-x "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions" \
	-x "github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2/options" \
	-x "github.com/prometheus/alertmanager" \
	-i pkg/api/swagger_tags.json \
	--exclude-tag=alpha \
	--include-tag=enterprise
endif

.PHONY: swagger-gen
swagger-gen: gen-go $(MERGED_SPEC_TARGET) swagger-validate

.PHONY: swagger-validate
swagger-validate: $(MERGED_SPEC_TARGET) $(SWAGGER) ## Validate API spec
	$(SWAGGER) validate --skip-warnings $(<)

.PHONY: swagger-clean
swagger-clean:
	rm -f $(SPEC_TARGET) $(MERGED_SPEC_TARGET) $(OAPI_SPEC_TARGET)

.PHONY: cleanup-old-git-hooks
cleanup-old-git-hooks:
	./scripts/cleanup-husky.sh

.PHONY: lefthook-install
lefthook-install: cleanup-old-git-hooks $(LEFTHOOK) # install lefthook for pre-commit hooks
	$(LEFTHOOK) install -f

.PHONY: lefthook-uninstall
lefthook-uninstall: $(LEFTHOOK)
	$(LEFTHOOK) uninstall

##@ OpenAPI 3
OAPI_SPEC_TARGET = public/openapi3.json

.PHONY: openapi3-gen
openapi3-gen: swagger-gen ## Generates OpenApi 3 specs from the Swagger 2 already generated
	$(GO) run $(GO_RACE_FLAG) scripts/openapi3/openapi3conv.go $(MERGED_SPEC_TARGET) $(OAPI_SPEC_TARGET)

##@ Internationalisation
.PHONY: i18n-extract-enterprise
ENTERPRISE_FE_EXT_FILE = public/app/extensions/index.ts
ifeq ("$(wildcard $(ENTERPRISE_FE_EXT_FILE))","") ## if enterprise is not enabled
i18n-extract-enterprise:
	@echo "Skipping i18n extract for Enterprise: not enabled"
else
i18n-extract-enterprise:
	@echo "Extracting i18n strings for Enterprise"
	yarn run i18next --config public/locales/i18next-parser-enterprise.config.cjs
	node ./public/locales/pseudo.mjs --mode enterprise
endif

.PHONY: i18n-extract
i18n-extract: i18n-extract-enterprise
	@echo "Extracting i18n strings for OSS"
	yarn run i18next --config public/locales/i18next-parser.config.cjs
	node ./public/locales/pseudo.mjs --mode oss

##@ Building
.PHONY: gen-cue
gen-cue: ## Do all CUE/Thema code generation
	@echo "generate code from .cue files"
	go generate ./kinds/gen.go
	go generate ./public/app/plugins/gen.go

.PHONY: gen-cuev2
gen-cuev2: ## Do all CUE code generation
	@echo "generate code from .cue files (v2)"
	go generate ./kindsv2/gen.go

.PHONY: gen-feature-toggles
gen-feature-toggles:
## First go test run fails because it will re-generate the feature toggles.
## Second go test run will compare the generated files and pass.
	@echo "generate feature toggles"
	go test -v ./pkg/services/featuremgmt/... > /dev/null 2>&1; \
	if [ $$? -eq 0 ]; then \
		echo "feature toggles already up-to-date"; \
	else \
		go test -v ./pkg/services/featuremgmt/...; \
	fi

.PHONY: gen-go
gen-go:
	@echo "generate go files"
	$(GO) run $(GO_RACE_FLAG) ./pkg/build/wire/cmd/wire/main.go gen -tags $(WIRE_TAGS) ./pkg/server

.PHONY: fix-cue
fix-cue: $(CUE)
	@echo "formatting cue files"
	$(CUE) fix kinds/**/*.cue
	$(CUE) fix public/app/plugins/**/**/*.cue

.PHONY: gen-jsonnet
gen-jsonnet:
	go generate ./devenv/jsonnet

.PHONY: update-workspace
update-workspace: gen-go
	@echo "updating workspace"
	bash scripts/go-workspace/update-workspace.sh

.PHONY: build-go
build-go: gen-go update-workspace ## Build all Go binaries.
	@echo "build go files with updated workspace"
	$(GO) run build.go $(GO_BUILD_FLAGS) build

build-go-fast: gen-go ## Build all Go binaries.
	@echo "build go files"
	$(GO) run build.go $(GO_BUILD_FLAGS) build

.PHONY: build-backend
build-backend: ## Build Grafana backend.
	@echo "build backend"
	$(GO) run build.go $(GO_BUILD_FLAGS) build-backend

.PHONY: build-server
build-server: ## Build Grafana server.
	@echo "build server"
	$(GO) run build.go $(GO_BUILD_FLAGS) build-server

.PHONY: build-cli
build-cli: ## Build Grafana CLI application.
	@echo "build grafana-cli"
	$(GO) run build.go $(GO_BUILD_FLAGS) build-cli

.PHONY: build-js
build-js: ## Build frontend assets.
	@echo "build frontend"
	yarn run build
	yarn run plugins:build-bundled

PLUGIN_ID ?=

.PHONY: build-plugin-go
build-plugin-go: ## Build decoupled plugins
	@echo "build plugin $(PLUGIN_ID)"
	@cd pkg/tsdb; \
	if [ -z "$(PLUGIN_ID)" ]; then \
		echo "PLUGIN_ID is not set"; \
		exit 1; \
	fi; \
	mage -v buildplugin $(PLUGIN_ID)

.PHONY: build
build: build-go build-js ## Build backend and frontend.

.PHONY: run
run: $(BRA) ## Build and run web server on filesystem changes. See /.bra.toml for configuration.
	$(BRA) run

.PHONY: run-go
run-go: ## Build and run web server immediately.
	$(GO) run -race $(if $(GO_BUILD_TAGS),-build-tags=$(GO_BUILD_TAGS)) \
		./pkg/cmd/grafana -- server -profile -profile-addr=127.0.0.1 -profile-port=6000 -packaging=dev cfg:app_mode=development

.PHONY: run-frontend
run-frontend: deps-js ## Fetch js dependencies and watch frontend for rebuild
	yarn start

##@ Testing

.PHONY: test-go
test-go: test-go-unit test-go-integration

.PHONY: test-go-unit
test-go-unit: ## Run unit tests for backend with flags.
	@echo "test backend unit tests"
	printf '$(GO_TEST_FILES)' | xargs \
	$(GO) test $(GO_RACE_FLAG) -short -covermode=atomic -timeout=30m

.PHONY: test-go-unit-pretty
test-go-unit-pretty: check-tparse
	@if [ -z "$(FILES)" ]; then \
		echo "Notice: FILES variable is not set. Try \"make test-go-unit-pretty FILES=./pkg/services/mysvc\""; \
		exit 1; \
	fi
	$(GO) test $(GO_RACE_FLAG) -timeout=10s $(FILES) -json | tparse -all

.PHONY: test-go-integration
test-go-integration: ## Run integration tests for backend with flags.
	@echo "test backend integration tests"
	$(GO) test $(GO_RACE_FLAG) -count=1 -run "^TestIntegration" -covermode=atomic -timeout=5m $(GO_INTEGRATION_TESTS)

.PHONY: test-go-integration-alertmanager
test-go-integration-alertmanager: ## Run integration tests for the remote alertmanager (config taken from the mimir_backend block).
	@echo "test remote alertmanager integration tests"
	$(GO) clean -testcache
	AM_URL=http://localhost:8080 AM_TENANT_ID=test \
	$(GO) test $(GO_RACE_FLAG) -count=1 -run "^TestIntegrationRemoteAlertmanager" -covermode=atomic -timeout=5m ./pkg/services/ngalert/...

.PHONY: test-go-integration-postgres
test-go-integration-postgres: devenv-postgres ## Run integration tests for postgres backend with flags.
	@echo "test backend integration postgres tests"
	$(GO) clean -testcache
	GRAFANA_TEST_DB=postgres \
	$(GO) test $(GO_RACE_FLAG) -p=1 -count=1 -run "^TestIntegration" -covermode=atomic -timeout=10m $(GO_INTEGRATION_TESTS)

.PHONY: test-go-integration-mysql
test-go-integration-mysql: devenv-mysql ## Run integration tests for mysql backend with flags.
	@echo "test backend integration mysql tests"
	GRAFANA_TEST_DB=mysql \
	$(GO) test $(GO_RACE_FLAG) -p=1 -count=1 -run "^TestIntegration" -covermode=atomic -timeout=10m $(GO_INTEGRATION_TESTS)

.PHONY: test-go-integration-redis
test-go-integration-redis: ## Run integration tests for redis cache.
	@echo "test backend integration redis tests"
	$(GO) clean -testcache
	REDIS_URL=localhost:6379 $(GO) test $(GO_RACE_FLAG) -run IntegrationRedis -covermode=atomic -timeout=2m $(GO_INTEGRATION_TESTS)

.PHONY: test-go-integration-memcached
test-go-integration-memcached: ## Run integration tests for memcached cache.
	@echo "test backend integration memcached tests"
	$(GO) clean -testcache
	MEMCACHED_HOSTS=localhost:11211 $(GO) test $(GO_RACE_FLAG) -run IntegrationMemcached -covermode=atomic -timeout=2m $(GO_INTEGRATION_TESTS)

.PHONY: test-js
test-js: ## Run tests for frontend.
	@echo "test frontend"
	yarn test

.PHONY: test
test: test-go test-js ## Run all tests.

##@ Linting
.PHONY: golangci-lint
golangci-lint: $(GOLANGCI_LINT)
	@echo "lint via golangci-lint"
	$(GOLANGCI_LINT) run \
		--config .golangci.yml \
		$(GO_LINT_FILES)

.PHONY: lint-go
lint-go: golangci-lint ## Run all code checks for backend. You can use GO_LINT_FILES to specify exact files to check

.PHONY: lint-go-diff
lint-go-diff: $(GOLANGCI_LINT)
	git diff --name-only $(GIT_BASE) | \
		grep '\.go$$' | \
		$(XARGSR) dirname | \
		sort -u | \
		sed 's,^,./,' | \
		$(XARGSR) $(GOLANGCI_LINT) run --config .golangci.toml

# with disabled SC1071 we are ignored some TCL,Expect `/usr/bin/env expect` scripts
.PHONY: shellcheck
shellcheck: $(SH_FILES) ## Run checks for shell scripts.
	@docker run --rm -v "$$PWD:/mnt" koalaman/shellcheck:stable \
	$(SH_FILES) -e SC1071 -e SC2162

##@ Docker

TAG_SUFFIX=$(if $(WIRE_TAGS)!=oss,-$(WIRE_TAGS))
PLATFORM=linux/amd64

.PHONY: build-docker-full
build-docker-full: ## Build Docker image for development.
	@echo "build docker container"
	tar -ch . | \
	docker buildx build - \
	--platform $(PLATFORM) \
	--build-arg BINGO=false \
	--build-arg GO_BUILD_TAGS=$(GO_BUILD_TAGS) \
	--build-arg WIRE_TAGS=$(WIRE_TAGS) \
	--build-arg COMMIT_SHA=$$(git rev-parse HEAD) \
	--build-arg BUILD_BRANCH=$$(git rev-parse --abbrev-ref HEAD) \
	--tag grafana/grafana$(TAG_SUFFIX):dev \
	$(DOCKER_BUILD_ARGS)

.PHONY: build-docker-full-ubuntu
build-docker-full-ubuntu: ## Build Docker image based on Ubuntu for development.
	@echo "build docker container"
	tar -ch . | \
	docker buildx build - \
	--platform $(PLATFORM) \
	--build-arg BINGO=false \
	--build-arg GO_BUILD_TAGS=$(GO_BUILD_TAGS) \
	--build-arg WIRE_TAGS=$(WIRE_TAGS) \
	--build-arg COMMIT_SHA=$$(git rev-parse HEAD) \
	--build-arg BUILD_BRANCH=$$(git rev-parse --abbrev-ref HEAD) \
	--build-arg BASE_IMAGE=ubuntu:22.04 \
	--build-arg GO_IMAGE=golang:$(GO_VERSION) \
	--tag grafana/grafana$(TAG_SUFFIX):dev-ubuntu \
	$(DOCKER_BUILD_ARGS)

##@ Services

COMPOSE := $(shell if docker compose --help >/dev/null 2>&1; then echo docker compose; else echo docker-compose; fi)
ifeq ($(COMPOSE),docker-compose)
$(warning From July 2023 Compose V1 (docker-compose) stopped receiving updates. Migrate to Compose V2 (docker compose). https://docs.docker.com/compose/migrate/)
endif

# Create a Docker Compose file with provided sources and start them.
# For example, `make devenv sources=postgres,auth/openldap`
.PHONY: devenv
ifeq ($(sources),)
devenv:
	@printf 'You have to define sources for this command \nexample: make devenv sources=postgres,auth/openldap\n'
else
devenv: devenv-down ## Start optional services like Postgresql, Prometheus, or Elasticsearch.
	@cd devenv; \
	./create_docker_compose.sh $(targets) || \
	(rm -rf {docker-compose.yaml,conf.tmp,.env}; exit 1)

	@cd devenv; \
	$(COMPOSE) up -d --build
endif

.PHONY: devenv-down
devenv-down: ## Stop optional services.
	@cd devenv; \
	test -f docker-compose.yaml && \
	$(COMPOSE) down || exit 0;

.PHONY: devenv-postgres
devenv-postgres:
	@cd devenv; \
	sources=postgres_tests

.PHONY: devenv-mysql
devenv-mysql:
	@cd devenv; \
	sources=mysql_tests

##@ Helpers

# We separate the protobuf generation because most development tasks on
# Grafana do not involve changing protobuf files and protoc is not a
# go-gettable dependency and so getting it installed can be inconvenient.
#
# If you are working on changes to protobuf interfaces you may either use
# this target or run the individual scripts below directly
.PHONY: protobuf
protobuf: ## Compile protobuf definitions
	bash scripts/protobuf-check.sh
	go install google.golang.org/protobuf/cmd/protoc-gen-go
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.4.0
	buf generate pkg/plugins/backendplugin/pluginextensionv2 --template pkg/plugins/backendplugin/pluginextensionv2/buf.gen.yaml
	buf generate pkg/plugins/backendplugin/secretsmanagerplugin --template pkg/plugins/backendplugin/secretsmanagerplugin/buf.gen.yaml
	buf generate pkg/storage/unified/resource --template pkg/storage/unified/resource/buf.gen.yaml
	buf generate pkg/services/authz/proto/v1 --template pkg/services/authz/proto/v1/buf.gen.yaml

.PHONY: clean
clean: ## Clean up intermediate build artifacts.
	@echo "cleaning"
	rm -rf node_modules
	rm -rf public/build

.PHONY: gen-ts
gen-ts:
	@echo "generating TypeScript definitions"
	go get github.com/tkrajina/typescriptify-golang-structs/typescriptify@v0.1.7
	tscriptify -interface -package=github.com/grafana/grafana/pkg/services/live/pipeline -import="import { FieldConfig } from '@grafana/data'" -target=public/app/features/live/pipeline/models.gen.ts pkg/services/live/pipeline/config.go
	go mod tidy

# This repository's configuration is protected (https://readme.drone.io/signature/).
# Use this make target to regenerate the configuration YAML files when
# you modify starlark files.
.PHONY: drone
drone: $(DRONE)
	bash scripts/drone/env-var-check.sh
	$(DRONE) starlark --format
	$(DRONE) lint .drone.yml --trusted
	$(DRONE) --server https://drone.grafana.net sign --save grafana/grafana

# Generate an Emacs tags table (https://www.gnu.org/software/emacs/manual/html_node/emacs/Tags-Tables.html) for Starlark files.
.PHONY: scripts/drone/TAGS
scripts/drone/TAGS: $(shell find scripts/drone -name '*.star')
	etags --lang none --regex="/def \(\w+\)[^:]+:/\1/" --regex="/\s*\(\w+\) =/\1/" $^ -o $@

.PHONY: format-drone
format-drone:
	buildifier --lint=fix -r scripts/drone

.PHONY: go-race-is-enabled
go-race-is-enabled:
	@if [ -n "$(GO_RACE)" ]; then \
		echo "The Go race detector is enabled locally, yey!"; \
	else \
		echo "The Go race detector is NOT enabled locally, boo!"; \
	fi;

.PHONY: enable-go-race
enable-go-race:
	@touch .go-race-enabled-locally

check-tparse:
	@command -v tparse >/dev/null 2>&1 || { \
		echo >&2 "Error: tparse is not installed. Refer to https://github.com/mfridman/tparse"; \
		exit 1; \
	}

.PHONY: help
help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
