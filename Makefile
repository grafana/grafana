## This is a self-documented Makefile. For usage information, run `make help`:
##
## For more information, refer to https://suva.sh/posts/well-documented-makefiles/

WIRE_TAGS = "oss"

-include local/Makefile
include .citools/Variables.mk

GO = go
GO_VERSION = 1.26.2
GO_HOST_OS := $(shell $(GO) env GOHOSTOS)
GO_HOST_ARCH := $(shell $(GO) env GOHOSTARCH)
GO_LINT_FILES ?= $(shell ./scripts/go-workspace/golangci-lint-includes.sh)
GO_TEST_FILES ?= $(shell ./scripts/go-workspace/test-includes.sh)
SH_FILES ?= $(shell find ./scripts -name *.sh)
GO_RACE  := $(shell [ -n "$(GO_RACE)" -o -e ".go-race-enabled-locally" ] && echo 1 )
GO_RACE_FLAG := $(if $(GO_RACE),-race)
# Backend build version and ldflags (release / packaging conventions).
BUILD_NUMBER ?= local
BUILD_VERSION := $(shell sed -n 's/.*"version": *"\(.*\)".*/\1/p' package.json | sed 's/-pre/-$(BUILD_NUMBER)/')
BUILD_COMMIT := $(if $(COMMIT_SHA),$(COMMIT_SHA),$(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown"))
BUILD_BRANCH := $(if $(BUILD_BRANCH),$(BUILD_BRANCH),$(shell git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main"))
BUILD_STAMP := $(or $(SOURCE_DATE_EPOCH),$(shell date +%s 2>/dev/null))
GO_LDFLAGS = -X main.version=$(BUILD_VERSION) \
	-X main.commit=$(BUILD_COMMIT) \
	-X main.buildBranch=$(BUILD_BRANCH) \
	-X main.buildstamp=$(BUILD_STAMP) \
	$(if $(ENTERPRISE_COMMIT_SHA),-X main.enterpriseCommit=$(ENTERPRISE_COMMIT_SHA)) \
	$(if $(LDFLAGS),-extldflags \"$(LDFLAGS)\")
GO_TEST_FLAGS += $(if $(GO_BUILD_TAGS),-tags=$(GO_BUILD_TAGS))
GO_BUILD_DEV_ENABLED := $(filter 1 dev,$(GO_BUILD_DEV))
GO_BUILD_GCFLAGS_EFFECTIVE := $(if $(GO_BUILD_GCFLAGS),$(GO_BUILD_GCFLAGS),$(if $(GO_BUILD_DEV_ENABLED),all=-N -l))
GO_BUILD_TRIMPATH_FLAG := $(if $(GO_BUILD_DEV_ENABLED),,-trimpath)
GO_BUILD_ENV = \
	$(if $(CGO_ENABLED),CGO_ENABLED=$(CGO_ENABLED)) \
	GOOS=$(OS) \
	GOARCH=$(ARCH) \
	$(if $(ARM),GOARM=$(ARM))
GO_BUILD_ARGS = \
	-buildvcs=false \
	$(GO_BUILD_TRIMPATH_FLAG) \
	$(GO_RACE_FLAG) \
	$(if $(GO_BUILD_TAGS),-tags $(GO_BUILD_TAGS)) \
	$(if $(GO_BUILD_GCFLAGS_EFFECTIVE),-gcflags "$(GO_BUILD_GCFLAGS_EFFECTIVE)") \
	-ldflags "$(GO_LDFLAGS)" \
	-o ./bin/$(OS)/$(ARCH)/grafana$(if $(filter windows,$(OS)),.exe) \
	./pkg/cmd/grafana
ifeq ($(filter undefined environment environment\ override,$(origin OS)),)
else
OS := $(or $(GOOS),$(shell $(GO) env GOOS))
endif
ifeq ($(filter undefined environment environment\ override,$(origin ARCH)),)
else
ARCH := $(or $(GOARCH),$(shell $(GO) env GOARCH))
endif
ifeq ($(filter undefined environment environment\ override,$(origin ARM)),)
else
ARM := $(GOARM)
endif
GIT_BASE = remotes/origin/main

CUE_VERSION = v0.16.0
CUE = $(shell go env GOPATH)/bin/cue

# GNU xargs has flag -r, and BSD xargs (e.g. MacOS) has that behaviour by default
XARGSR = $(shell xargs --version 2>&1 | grep -q GNU && echo xargs -r || echo xargs)

# Test sharding to replicate CI behaviour locally.
SHARD ?= 1
SHARDS ?= 1

targets := $(shell echo '$(sources)' | tr "," " ")

.PHONY: all
all: deps build

##@ Dependencies

.PHONY: deps-go
deps-go: ## Install backend dependencies.
	go mod download

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

$(MERGED_SPEC_TARGET): swagger-oss-gen swagger-enterprise-gen $(NGALERT_SPEC_TARGET)  ## Merge generated and ngalert API specs
	# known conflicts DsPermissionType, AddApiKeyCommand, Json, Duration (identical models referenced by both specs)
	GODEBUG=gotypesalias=0 $(swagger) mixin -q $(SPEC_TARGET) $(ENTERPRISE_SPEC_TARGET) $(NGALERT_SPEC_TARGET) --ignore-conflicts -o $(MERGED_SPEC_TARGET)

.PHONY: swagger-oss-gen
swagger-oss-gen: ## Generate API Swagger specification
	@echo "re-generating swagger for OSS"
	rm -f $(SPEC_TARGET)
	SWAGGER_GENERATE_EXTENSION=false GODEBUG=gotypesalias=0 $(swagger) generate spec -q -m -w pkg/server -o $(SPEC_TARGET) \
	-x "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions" \
	-x "github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2/options" \
	-x "github.com/prometheus/alertmanager" \
	-x "github.com/docker/docker" \
	-x "github.com/moby/moby" \
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
swagger-enterprise-gen: ## Generate API Swagger specification
	@echo "re-generating swagger for enterprise"
	rm -f $(ENTERPRISE_SPEC_TARGET)
	SWAGGER_GENERATE_EXTENSION=false GODEBUG=gotypesalias=0 $(swagger) generate spec -q -m -w pkg/server -o $(ENTERPRISE_SPEC_TARGET) \
	-x "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions" \
	-x "github.com/grpc-ecosystem/grpc-gateway/v2/protoc-gen-openapiv2/options" \
	-x "github.com/prometheus/alertmanager" \
	-x "github.com/docker/docker" \
	-x "github.com/moby/moby" \
	-i pkg/api/swagger_tags.json \
	-t enterprise \
	--exclude-tag=alpha \
	--include-tag=enterprise
endif

.PHONY: swagger-gen
swagger-gen: gen-go $(MERGED_SPEC_TARGET) swagger-validate

.PHONY: swagger-validate
swagger-validate: $(MERGED_SPEC_TARGET) # Validate API spec
	GODEBUG=gotypesalias=0 $(swagger) validate --skip-warnings $(<)

.PHONY: swagger-clean
swagger-clean:
	rm -f $(SPEC_TARGET) $(MERGED_SPEC_TARGET) $(OAPI_SPEC_TARGET)

.PHONY: lefthook-install
lefthook-install: # install lefthook for pre-commit hooks
	$(lefthook) install -f

.PHONY: lefthook-uninstall
lefthook-uninstall:
	$(lefthook) uninstall

##@ OpenAPI 3
OAPI_SPEC_TARGET = public/openapi3.json

.PHONY: openapi3-gen
openapi3-gen: swagger-gen ## Generates OpenApi 3 specs from the Swagger 2 already generated
	$(GO) run $(GO_RACE_FLAG) scripts/openapi3/openapi3conv.go cleanup $(ENTERPRISE_SPEC_TARGET) $(MERGED_SPEC_TARGET)
	$(GO) run $(GO_RACE_FLAG) scripts/openapi3/openapi3conv.go $(MERGED_SPEC_TARGET) $(OAPI_SPEC_TARGET)

.PHONY: generate-openapi
generate-openapi: openapi3-gen
	$(GO) test ./pkg/tests/apis || true
	yarn workspace @grafana/openapi process-specs

##@ Internationalisation
.PHONY: i18n-extract-enterprise
ENTERPRISE_FE_EXT_FILE = public/app/extensions/index.ts
ifeq ("$(wildcard $(ENTERPRISE_FE_EXT_FILE))","") ## if enterprise is not enabled
i18n-extract-enterprise:
	@echo "Skipping i18n extract for Enterprise: not enabled"
else
i18n-extract-enterprise:
	@echo "Extracting i18n strings for Enterprise"
	cd public/locales/enterprise && LANG=en_US.UTF-8 yarn run i18next-cli extract --sync-primary
endif

.PHONY: i18n-extract
i18n-extract: i18n-extract-enterprise
	@echo "Extracting i18n strings for OSS"
	LANG=en_US.UTF-8 yarn run i18next-cli extract --sync-primary
	@echo "Extracting i18n strings for packages"
	LANG=en_US.UTF-8 yarn run packages:i18n-extract
	@echo "Extracting i18n strings for plugins"
	LANG=en_US.UTF-8 yarn run plugin:i18n-extract

##@ Building
.PHONY: gen-cue
gen-cue: ## Do all CUE/Thema code generation
	@echo "generate code from .cue files"
	go generate ./kinds/gen.go
	go generate ./public/app/plugins/gen.go
	@echo "// This file is managed by Grafana - DO NOT EDIT MANUALLY" > apps/dashboard/pkg/apis/dashboard/v0alpha1/dashboard_kind.cue
	@echo "// Source: kinds/dashboard/dashboard_kind.cue" >> apps/dashboard/pkg/apis/dashboard/v0alpha1/dashboard_kind.cue
	@echo "// To sync changes, run: make gen-cue" >> apps/dashboard/pkg/apis/dashboard/v0alpha1/dashboard_kind.cue
	@echo "" >> apps/dashboard/pkg/apis/dashboard/v0alpha1/dashboard_kind.cue
	@cat kinds/dashboard/dashboard_kind.cue >> apps/dashboard/pkg/apis/dashboard/v0alpha1/dashboard_kind.cue
	@cp apps/dashboard/pkg/apis/dashboard/v0alpha1/dashboard_kind.cue apps/dashboard/pkg/apis/dashboard/v1/dashboard_kind.cue


APPS_DIRS=$(shell find ./apps -type d -exec test -f "{}/Makefile" \; -print | sort)
# Alternatively use an explicit list of apps:
# APPS_DIRS := ./apps/dashboard ./apps/folder ./apps/alerting/notifications

# Optional app variable to specify a single app to generate
# Usage: make gen-apps app=dashboard
app ?=

.PHONY: gen-apps
gen-apps: fix-cue do-gen-apps gofmt ## Generate code for Grafana App SDK apps and run gofmt and fix-cue. Use app=<name> to generate for a specific app.
## NOTE: codegen produces some openapi files that result in circular dependencies
## for now, we revert the zz_openapi_gen.go files before comparison
	@if [ -n "$$CODEGEN_VERIFY" ]; then \
	  git checkout HEAD -- apps/alerting/rules/pkg/apis/alerting/v0alpha1/zz_openapi_gen.go; \
		git checkout HEAD -- apps/iam/pkg/apis/iam/v0alpha1/zz_openapi_gen.go; \
    git checkout HEAD -- apps/secret/pkg/apis/secret/v1beta1/zz_openapi_gen.go; \
		echo "Verifying generated code is up to date..."; \
		if ! git diff --quiet; then \
			echo "Error: Generated code is not up to date. Please run 'make gen-apps' (optionally with app=<name>), 'make gen-cue', and 'make gen-jsonnet' to regenerate."; \
			git diff --name-only; \
			exit 1; \
		fi; \
		echo "Generated apps code is up to date."; \
	fi

.PHONY: do-gen-apps
do-gen-apps: ## Generate code for Grafana App SDK apps
	@if [ -n "$(app)" ]; then \
		app_dir="./apps/$(app)"; \
		if [ ! -f "$$app_dir/Makefile" ]; then \
			echo "Error: App '$(app)' not found or does not have a Makefile at $$app_dir"; \
			exit 1; \
		fi; \
		echo "Generating code for app: $(app)"; \
		$(MAKE) -C $$app_dir generate; \
	else \
		for dir in $(APPS_DIRS); do \
			$(MAKE) -C $$dir generate; \
		done; \
		./hack/update-codegen.sh; \
	fi

.PHONY: gen-feature-toggles
gen-feature-toggles:
## First go test run fails because it will re-generate the feature toggles.
## Second go test run will compare the generated files and pass.
	@echo "generate feature toggles"
	go test ./pkg/services/featuremgmt/... > /dev/null 2>&1; \
	if [ $$? -eq 0 ]; then \
		echo "feature toggles already up-to-date"; \
	else \
		go test ./pkg/services/featuremgmt/...; \
	fi


.PHONY: gen-go gen-enterprise-go
ifeq ("$(wildcard $(ENTERPRISE_EXT_FILE))","") ## if enterprise is not enabled
gen-enterprise-go:
	@echo "skipping re-generating Wire graph for enterprise: not enabled"
else
gen-enterprise-go: ## Generate Wire graph (Enterprise)
	@echo "re-generating Wire graph for enterprise"
	$(GO) run ./pkg/build/wire/cmd/wire/main.go gen -tags "enterprise" -gen_tags "(enterprise || pro)" -output_file_prefix="enterprise_" ./pkg/server
endif
gen-go: gen-enterprise-go ## Generate Wire graph
	@echo "generating Wire graph"
	$(GO) run ./pkg/build/wire/cmd/wire/main.go gen -tags "oss" -gen_tags "(!enterprise && !pro)" ./pkg/server

.PHONY: gen-app-manifests-unistore
gen-app-manifests-unistore: ## Generate unified storage app manifests list
	@echo "generating unified storage app manifests"
	$(GO) generate ./pkg/storage/unified/resource/app_manifests.go
	@if [ -n "$$CODEGEN_VERIFY" ]; then \
		echo "Verifying generated code is up to date..."; \
		if ! git diff --quiet pkg/storage/unified/resource/app_manifests.go; then \
			echo "Error: pkg/storage/unified/resource/app_manifests.go is not up to date. Please run 'make gen-app-manifests-unistore' to regenerate."; \
			git diff pkg/storage/unified/resource/app_manifests.go; \
			exit 1; \
		fi; \
		echo "Generated app manifests code is up to date."; \
	fi

.PHONY: install-cue
install-cue:
	go install cuelang.org/go/cmd/cue@$(CUE_VERSION)

.PHONY: fix-cue
fix-cue: install-cue ## Format and fix CUE files. Use app=<name> to fix a specific app.
	@set -e; \
	root_dir="."; \
	if [ -n "$(app)" ]; then \
		root_dir="./apps/$(app)"; \
		if [ ! -d "$$root_dir" ]; then \
			echo "Error: App '$(app)' not found at $$root_dir"; \
			exit 1; \
		fi; \
	fi; \
	for mod_dir in $$(find "$$root_dir" -type d -name 'cue.mod'); do \
		project_dir="$$(dirname $$mod_dir)"; \
		echo "Fixing: $$project_dir"; \
		(cd "$$project_dir" && $(CUE) fmt ./...); \
		(cd "$$project_dir" && $(CUE) fix ./...); \
	done

.PHONY: gen-jsonnet
gen-jsonnet:
	go generate ./devenv/jsonnet

.PHONY: gen-themes
gen-themes:
	GOOS=$(GO_HOST_OS) GOARCH=$(GO_HOST_ARCH) $(GO) generate ./pkg/services/preference

pkg/services/preference/themes_generated.go:
	$(MAKE) gen-themes

.PHONY: generate-enterprise-imports
ifeq ("$(wildcard $(ENTERPRISE_EXT_FILE))","") ## if enterprise is not enabled
generate-enterprise-imports:
	@echo "skipping generating enterprise imports file"
else
generate-enterprise-imports: ## Generate Enterprise imports file
	@echo "re-generating enterprise imports file"
	$(GO) run ./scripts/ci/generate-enterprise-imports/main.go
endif

.PHONY: update-workspace
update-workspace: gen-go generate-enterprise-imports
	@echo "updating workspace"
	bash scripts/go-workspace/update-workspace.sh

.PHONY: build-go
build-go: pkg/services/preference/themes_generated.go
	@echo "compiling backend ($(OS)/$(ARCH))"
	$(GO_BUILD_ENV) \
	$(GO) build $(GO_BUILD_ARGS)
	if [ "$(OS)" = "$(GO_HOST_OS)" ] && [ "$(ARCH)" = "$(GO_HOST_ARCH)" ]; then cp ./bin/$(OS)/$(ARCH)/grafana ./bin/grafana; fi

bin/$(OS)/$(ARCH)/grafana$(if $(filter windows,$(OS)),.exe):
	$(MAKE) build-go

.PHONY: build-backend
build-backend: build-go

.PHONY: build-air
build-air: build-go
	@cp ./bin/grafana ./bin/grafana-air

.PHONY: build-js
build-js: ## Build frontend assets.
	@echo "building frontend"
	yarn run build

public/build:
	$(MAKE) build-js

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

# Packaging variables (artifact / file naming).
TARGZ_PACKAGE_NAME ?= grafana
FPM_LICENSE        ?= AGPLv3
ARCH_LABEL         := $(if $(ARM),$(ARCH)-$(ARM),$(ARCH))
# armv6 debs use a -rpi suffix to match daggerbuild behavior (grafana-rpi, grafana-enterprise-rpi).
DEB_PACKAGE_NAME   := $(if $(filter 6,$(ARM)),$(TARGZ_PACKAGE_NAME)-rpi,$(TARGZ_PACKAGE_NAME))
TARGZ_FILE         := dist/$(TARGZ_PACKAGE_NAME)_$(BUILD_VERSION)_$(BUILD_NUMBER)_$(OS)_$(ARCH_LABEL).tar.gz
DEB_FILE           := dist/$(DEB_PACKAGE_NAME)_$(BUILD_VERSION)_$(BUILD_NUMBER)_$(OS)_$(ARCH_LABEL).deb
RPM_FILE           := dist/$(TARGZ_PACKAGE_NAME)_$(BUILD_VERSION)_$(BUILD_NUMBER)_$(OS)_$(ARCH_LABEL).rpm
DOCKER_FILE        := dist/$(TARGZ_PACKAGE_NAME)_$(BUILD_VERSION)_$(BUILD_NUMBER)_$(OS)_$(ARCH_LABEL).docker.tar.gz
DOCKER_UBUNTU_FILE := dist/$(TARGZ_PACKAGE_NAME)_$(BUILD_VERSION)_$(BUILD_NUMBER)_$(OS)_$(ARCH_LABEL).ubuntu.docker.tar.gz
DOCKER_TAG         ?= $(TARGZ_PACKAGE_NAME):$(BUILD_VERSION)

# Default catalog plugins under data/plugins-bundled. Stamp encodes OS/ARCH so cross-builds refresh.
DATA_PLUGINS_BUNDLED_STAMP := data/plugins-bundled/.platform-$(OS)-$(ARCH).stamp

$(DATA_PLUGINS_BUNDLED_STAMP): package.json \
		scripts/download-catalog-plugins.sh \
		scripts/catalog-plugins-defaults
	@echo "bundling plugins ($(OS)/$(ARCH))"
	@rm -rf data/plugins-bundled
	@mkdir -p data/plugins-bundled
	@bash scripts/download-catalog-plugins.sh \
		--out data/plugins-bundled \
		--grafana-version "$(BUILD_VERSION)" \
		--os "$(OS)" \
		--arch "$(ARCH)"
	@touch $(DATA_PLUGINS_BUNDLED_STAMP)

data/plugins-bundled: $(DATA_PLUGINS_BUNDLED_STAMP)
	@:

.PHONY: build-catalog-plugins-data
build-catalog-plugins-data: data/plugins-bundled ## Download default catalog plugins into data/plugins-bundled (network; alias).

.PHONY: build-targz
build-targz: $(TARGZ_FILE) ## Build a tar.gz package (bin, public, conf, plugins-bundled/, data/plugins-bundled from catalog)

$(TARGZ_FILE): data/plugins-bundled | bin/$(OS)/$(ARCH)/grafana$(if $(filter windows,$(OS)),.exe) public/build
	@echo "assembling tar.gz"
	TARGZ_PACKAGE_NAME="$(TARGZ_PACKAGE_NAME)" \
	BUILD_VERSION="$(BUILD_VERSION)" \
	BUILD_NUMBER="$(BUILD_NUMBER)" \
	OS="$(OS)" \
	ARCH="$(ARCH)" \
	$(if $(ARM),GOARM="$(ARM)") \
	GO="$(GO)" \
	bash scripts/build-targz.sh

.PHONY: build-deb
build-deb: $(DEB_FILE) ## Build a .deb package from a tar.gz (requires fpm)

$(DEB_FILE): $(TARGZ_FILE)
	@echo "building deb"
	TARGZ_PACKAGE_NAME="$(TARGZ_PACKAGE_NAME)" \
	BUILD_VERSION="$(BUILD_VERSION)" \
	BUILD_NUMBER="$(BUILD_NUMBER)" \
	OS="$(OS)" \
	ARCH="$(ARCH)" \
	FPM_LICENSE="$(FPM_LICENSE)" \
	$(if $(ARM),GOARM="$(ARM)") \
	bash scripts/build-deb.sh

.PHONY: build-rpm
build-rpm: $(RPM_FILE) ## Build an .rpm package from a tar.gz (requires fpm)

$(RPM_FILE): $(TARGZ_FILE)
	@echo "building rpm"
	TARGZ_PACKAGE_NAME="$(TARGZ_PACKAGE_NAME)" \
	BUILD_VERSION="$(BUILD_VERSION)" \
	BUILD_NUMBER="$(BUILD_NUMBER)" \
	OS="$(OS)" \
	ARCH="$(ARCH)" \
	FPM_LICENSE="$(FPM_LICENSE)" \
	$(if $(ARM),GOARM="$(ARM)") \
	bash scripts/build-rpm.sh

.PHONY: build-docker
build-docker: $(DOCKER_FILE) ## Build a Docker image (alpine) from a tar.gz

$(DOCKER_FILE): $(TARGZ_FILE)
	@echo "building docker image (alpine)"
	docker buildx build \
	--platform $(OS)/$(ARCH) \
	--build-arg GRAFANA_TGZ=$(TARGZ_FILE) \
	--build-arg GO_SRC=tgz-builder \
	--build-arg JS_SRC=tgz-builder \
	--target=final-alpine \
	--tag $(DOCKER_TAG) \
	--output type=docker,dest=$@ \
	.

.PHONY: build-docker-ubuntu
build-docker-ubuntu: $(DOCKER_UBUNTU_FILE) ## Build a Docker image (ubuntu) from a tar.gz

$(DOCKER_UBUNTU_FILE): $(TARGZ_FILE)
	@echo "building docker image (ubuntu)"
	docker buildx build \
	--platform $(OS)/$(ARCH) \
	--build-arg GRAFANA_TGZ=$(TARGZ_FILE) \
	--build-arg GO_SRC=tgz-builder \
	--build-arg JS_SRC=tgz-builder \
	--target=final-ubuntu \
	--tag $(DOCKER_TAG) \
	--output type=docker,dest=$@ \
	.

.PHONY: run
run: ## Build and run backend, and watch for changes. See .air.toml for configuration.
	$(air) -c .air.toml

.PHONY: run-go
run-go: ## Build and run web server immediately.
	$(GO) run -race $(if $(GO_BUILD_TAGS),-build-tags=$(GO_BUILD_TAGS)) \
		./pkg/cmd/grafana -- server -profile -profile-addr=127.0.0.1 -profile-port=6000 -packaging=dev cfg:app_mode=development

.PHONY: run-frontend
run-frontend: deps-js ## Fetch js dependencies and watch frontend for rebuild
	yarn start

.PHONY: frontend-service-check
frontend-service-check:
	./devenv/frontend-service/local-init.sh

.PHONY: frontend-service
frontend-service: frontend-service-check
	bash ./devenv/frontend-service/run.sh

##@ Testing

.PHONY: test-go
test-go: test-go-unit test-go-integration

.PHONY: test-go-unit
test-go-unit: ## Run unit tests for backend with flags.
	@echo "backend unit tests ($(SHARD)/$(SHARDS))"
	$(GO) test $(GO_RACE_FLAG) $(GO_TEST_FLAGS) -v -short -timeout=30m \
		$(shell ./scripts/ci/backend-tests/shard.sh -n$(SHARD) -m$(SHARDS) -s)

.PHONY: test-go-unit-pretty
test-go-unit-pretty: check-tparse
	@if [ -z "$(FILES)" ]; then \
		echo "Notice: FILES variable is not set. Try \"make test-go-unit-pretty FILES=./pkg/services/mysvc\""; \
		exit 1; \
	fi
	$(GO) test $(GO_RACE_FLAG) $(GO_TEST_FLAGS) -timeout=10s $(FILES) -json | tparse -all

.PHONY: test-go-integration
test-go-integration: ## Run integration tests for backend with flags.
	@echo "test backend integration tests"
	$(GO) test $(GO_RACE_FLAG) $(GO_TEST_FLAGS) -count=1 -run "^TestIntegration" -covermode=atomic -coverprofile=$(GO_INTEGRATION_COVER_PROFILE) -timeout=5m \
		$(shell ./scripts/ci/backend-tests/pkgs-with-tests-named.sh -b TestIntegration | ./scripts/ci/backend-tests/shard.sh -n$(SHARD) -m$(SHARDS) -d - -s)

.PHONY: test-go-integration-alertmanager
test-go-integration-alertmanager: ## Run integration tests for the remote alertmanager (config taken from the mimir_backend block).
	@echo "test remote alertmanager integration tests"
	$(GO) clean -testcache
	AM_URL=http://localhost:8080 AM_TENANT_ID=test \
	$(GO) test $(GO_RACE_FLAG) -count=1 -run "^TestIntegrationRemoteAlertmanager" -covermode=atomic -timeout=5m ./pkg/services/ngalert/...

.PHONY: test-go-integration-grafana-alertmanager
test-go-integration-grafana-alertmanager: ## Run integration tests for the grafana alertmanager
	@echo "test grafana alertmanager integration tests"
	@export GRAFANA_VERSION=11.5.0-81938; \
	$(GO) run tools/setup_grafana_alertmanager_integration_test_images.go; \
	$(GO) clean -testcache; \
	$(GO) test $(GO_RACE_FLAG) -count=1 -run "^TestAlertmanagerIntegration" -covermode=atomic -timeout=10m ./pkg/tests/alertmanager/...

.PHONY: test-go-integration-postgres
test-go-integration-postgres: devenv-postgres ## Run integration tests for postgres backend with flags.
	@echo "test backend integration postgres tests"
	$(GO) clean -testcache
	GRAFANA_TEST_DB=postgres \
	$(GO) test $(GO_RACE_FLAG) $(GO_TEST_FLAGS) -p=1 -count=1 -run "^TestIntegration" -covermode=atomic -timeout=10m \
		$(shell ./scripts/ci/backend-tests/pkgs-with-tests-named.sh -b TestIntegration | ./scripts/ci/backend-tests/shard.sh -n$(SHARD) -m$(SHARDS) -d - -s)

.PHONY: test-go-integration-mysql
test-go-integration-mysql: devenv-mysql ## Run integration tests for mysql backend with flags.
	@echo "test backend integration mysql tests"
	GRAFANA_TEST_DB=mysql \
	$(GO) test $(GO_RACE_FLAG) $(GO_TEST_FLAGS) -p=1 -count=1 -run "^TestIntegration" -covermode=atomic -timeout=10m \
		$(shell ./scripts/ci/backend-tests/pkgs-with-tests-named.sh -b TestIntegration | ./scripts/ci/backend-tests/shard.sh -n$(SHARD) -m$(SHARDS) -d - -s)

.PHONY: test-go-integration-redis
test-go-integration-redis: ## Run integration tests for redis cache.
	@echo "test backend integration redis tests"
	$(GO) clean -testcache
	REDIS_URL=localhost:6379 $(GO) test $(GO_TEST_FLAGS) -run IntegrationRedis -covermode=atomic -timeout=2m \
		$(shell ./scripts/ci/backend-tests/pkgs-with-tests-named.sh -b TestIntegration | ./scripts/ci/backend-tests/shard.sh -n$(SHARD) -m$(SHARDS) -d - -s)

.PHONY: test-go-integration-memcached
test-go-integration-memcached: ## Run integration tests for memcached cache.
	@echo "test backend integration memcached tests"
	$(GO) clean -testcache
	MEMCACHED_HOSTS=localhost:11211 $(GO) test $(GO_RACE_FLAG) $(GO_TEST_FLAGS) -run IntegrationMemcached -covermode=atomic -timeout=2m \
		$(shell ./scripts/ci/backend-tests/pkgs-with-tests-named.sh -b TestIntegration | ./scripts/ci/backend-tests/shard.sh -n$(SHARD) -m$(SHARDS) -d - -s)

.PHONY: test-js
test-js: ## Run tests for frontend.
	@echo "test frontend"
	yarn test

.PHONY: test
test: test-go test-js ## Run all tests.

##@ Linting
.PHONY: golangci-lint
golangci-lint:
	@echo "lint via golangci-lint"
	$(golangci-lint) run \
		--config .golangci.yml \
		$(if $(GO_BUILD_TAGS),--build-tags $(GO_BUILD_TAGS)) \
		$(GO_LINT_FILES)

.PHONY: lint-go
lint-go: golangci-lint ## Run all code checks for backend. You can use GO_LINT_FILES to specify exact files to check

.PHONY: lint-go-diff
lint-go-diff:
	git diff --name-only $(GIT_BASE) | \
		grep '\.go$$' | \
		$(XARGSR) dirname | \
		sort -u | \
		sed 's,^,./,' | \
		$(XARGSR) $(golangci-lint) run --config .golangci.yml

.PHONY: gofmt
gofmt: ## Run gofmt for all Go files.
	@go list -m -f '{{.Dir}}' | xargs -I{} sh -c 'test ! -f {}/.nolint && echo {}' | xargs gofmt -s -w 2>&1 | grep -v '/pkg/build/' || true

# with disabled SC1071 we are ignored some TCL,Expect `/usr/bin/env expect` scripts
.PHONY: shellcheck
shellcheck: $(SH_FILES) ## Run checks for shell scripts.
	@docker run --rm -v "$$PWD:/mnt" koalaman/shellcheck:stable \
	$(SH_FILES) -e SC1071 -e SC2162

##@ Docker

TAG_SUFFIX=$(if $(WIRE_TAGS)!=oss,-$(WIRE_TAGS))
PLATFORM=linux/amd64

# default to a production build for frontend
#
DOCKER_JS_NODE_ENV_FLAG = production
DOCKER_JS_YARN_BUILD_FLAG = build
DOCKER_JS_YARN_INSTALL_FLAG = --immutable
#
# if go is in dev mode, also build node in dev mode
ifneq ($(filter 1 dev,$(GO_BUILD_DEV)),)
  DOCKER_JS_NODE_ENV_FLAG = dev
  DOCKER_JS_YARN_BUILD_FLAG = dev
	DOCKER_JS_YARN_INSTALL_FLAG =
endif
# if NODE_ENV is set in the environment to dev, build frontend in dev mode, and allow go builds to use their default
ifeq (${NODE_ENV}, dev)
  DOCKER_JS_NODE_ENV_FLAG = dev
  DOCKER_JS_YARN_BUILD_FLAG = dev
	DOCKER_JS_YARN_INSTALL_FLAG =
endif

.PHONY: build-docker-full
build-docker-full: ## Build Docker image for development.
	@echo "build docker container mode=($(DOCKER_JS_NODE_ENV_FLAG))"
	docker buildx build \
	--platform $(PLATFORM) \
	--build-arg NODE_ENV=$(DOCKER_JS_NODE_ENV_FLAG) \
	--build-arg JS_NODE_ENV=$(DOCKER_JS_NODE_ENV_FLAG) \
	--build-arg JS_YARN_INSTALL_FLAG=$(DOCKER_JS_YARN_INSTALL_FLAG) \
	--build-arg JS_YARN_BUILD_FLAG=$(DOCKER_JS_YARN_BUILD_FLAG) \
	--build-arg GO_BUILD_TAGS=$(GO_BUILD_TAGS) \
	--build-arg WIRE_TAGS=$(WIRE_TAGS) \
	--build-arg COMMIT_SHA=$$(git rev-parse HEAD) \
	--build-arg BUILD_BRANCH=$$(git rev-parse --abbrev-ref HEAD) \
	--target=final-alpine \
	--tag grafana/grafana$(TAG_SUFFIX):dev \
	$(DOCKER_BUILD_ARGS) \
	.

.PHONY: build-docker-full-ubuntu
build-docker-full-ubuntu: ## Build Docker image based on Ubuntu for development.
	@echo "build docker container mode=($(DOCKER_JS_NODE_ENV_FLAG))"
	docker buildx build \
	--platform $(PLATFORM) \
	--build-arg NODE_ENV=$(DOCKER_JS_NODE_ENV_FLAG) \
	--build-arg JS_NODE_ENV=$(DOCKER_JS_NODE_ENV_FLAG) \
	--build-arg JS_YARN_INSTALL_FLAG=$(DOCKER_JS_YARN_INSTALL_FLAG) \
	--build-arg JS_YARN_BUILD_FLAG=$(DOCKER_JS_YARN_BUILD_FLAG) \
	--build-arg GO_BUILD_TAGS=$(GO_BUILD_TAGS) \
	--build-arg WIRE_TAGS=$(WIRE_TAGS) \
	--build-arg COMMIT_SHA=$$(git rev-parse HEAD) \
	--build-arg BUILD_BRANCH=$$(git rev-parse --abbrev-ref HEAD) \
	--build-arg GO_IMAGE=golang:$(GO_VERSION) \
	--target=final-ubuntu \
	--tag grafana/grafana$(TAG_SUFFIX):dev-ubuntu \
	$(DOCKER_BUILD_ARGS) \
	.

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
	go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.5
	go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.4.0
	buf generate apps/secret --template apps/secret/buf.gen.yaml
	buf generate pkg/storage/unified/proto --template pkg/storage/unified/proto/buf.gen.yaml
	buf generate pkg/services/authz/proto/v1 --template pkg/services/authz/proto/v1/buf.gen.yaml
	buf generate pkg/services/ngalert/store/proto/v1 --template pkg/services/ngalert/store/proto/v1/buf.gen.yaml
	buf generate pkg/registry/apps/annotation/proto --template pkg/registry/apps/annotation/proto/buf.gen.yaml

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

# check licenses of used dependencies (can be run using build image using
# container/check-licenses target)
check-licenses:
	license_finder --decisions-file .github/license_finder.yaml

GENERATE_POLICY_BOT_CONFIG_SHA := sha256:d05ff5c7d4247da155c85f8c6f1f9f7c6d013d1f3fd9fd9d68eb06f1e7b0393d # v0.2.0
.PHONY: .policy.yml
.policy.yml:
	docker run -u "$(shell id -u):$(shell id -g)" \
	--quiet \
	--rm \
	--volume "$(shell git rev-parse --show-toplevel)":/work \
	--workdir /work \
	ghcr.io/grafana/generate-policy-bot-config@${GENERATE_POLICY_BOT_CONFIG_SHA} \
		--output .policy.yml \
		--log-level=debug \
		--merge-with=.policy.yml.tmpl \
		.
# We don't want the patch workflow to be run. This is exclusively useful for the security-mirror. It won't work in OSS.
	sed -i.bak '/- Workflow \.github\/workflows\/create-security-patch-from-security-mirror/d' .policy.yml; rm -f .policy.yml.bak
