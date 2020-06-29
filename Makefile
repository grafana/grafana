## This is a self-documented Makefile. For usage information, run `make help`:
##
## For more information, refer to https://suva.sh/posts/well-documented-makefiles/

-include local/Makefile

.PHONY: all deps-go deps-js deps build-go build-server build-cli build-js build build-docker-dev build-docker-full lint-go revive golangci-lint test-go test-js test run run-frontend clean devenv devenv-down revive-strict protobuf help

GO = GO111MODULE=on go
GO_FILES ?= ./pkg/...
SH_FILES ?= $(shell find ./scripts -name *.sh)

all: deps build

##@ Dependencies

deps-go: ## Install backend dependencies.
	$(GO) run build.go setup

deps-js: node_modules ## Install frontend dependencies.

deps: deps-js ## Install all dependencies.

node_modules: package.json yarn.lock ## Install node modules.
	@echo "install frontend dependencies"
	yarn install --pure-lockfile --no-progress

##@ Building

build-go: ## Build all Go binaries.
	@echo "build go files"
	$(GO) run build.go build

build-server: ## Build Grafana server.
	@echo "build server"
	$(GO) run build.go build-server

build-cli: ## Build Grafana CLI application.
	@echo "build in CI environment"
	$(GO) run build.go build-cli

build-js: ## Build frontend assets.
	@echo "build frontend"
	yarn run build
	yarn run plugins:build-bundled

build: build-go build-js ## Build backend and frontend.

scripts/go/bin/bra: scripts/go/go.mod
	@cd scripts/go; \
	$(GO) build -o ./bin/bra github.com/unknwon/bra

run: scripts/go/bin/bra ## Build and run web server on filesystem changes.
	@GO111MODULE=on scripts/go/bin/bra run

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

scripts/go/bin/revive: scripts/go/go.mod
	@cd scripts/go; \
	$(GO) build -o ./bin/revive github.com/mgechev/revive

revive: scripts/go/bin/revive
	@echo "lint via revive"
	@scripts/go/bin/revive \
		-formatter stylish \
		-config ./scripts/go/configs/revive.toml \
		$(GO_FILES)

revive-strict: scripts/go/bin/revive
	@echo "lint via revive (strict)"
	@scripts/go/bin/revive \
		-formatter stylish \
		-config ./scripts/go/configs/revive-strict.toml \
		-exclude ./pkg/plugins/backendplugin/pluginextensionv2/... \
		./pkg/services/alerting/... \
		./pkg/services/provisioning/datasources/... \
		./pkg/services/provisioning/dashboards/... \
		./pkg/plugins/backendplugin/...

scripts/go/bin/golangci-lint: scripts/go/go.mod
	@cd scripts/go; \
	$(GO) build -o ./bin/golangci-lint github.com/golangci/golangci-lint/cmd/golangci-lint

golangci-lint: scripts/go/bin/golangci-lint
	@echo "lint via golangci-lint"
	@scripts/go/bin/golangci-lint run \
		--config ./scripts/go/configs/.golangci.yml \
		$(GO_FILES)

lint-go: golangci-lint revive revive-strict # Run all code checks for backend.

# with disabled SC1071 we are ignored some TCL,Expect `/usr/bin/env expect` scripts
shellcheck: $(SH_FILES) ## Run checks for shell scripts.
	@docker run --rm -v "$$PWD:/mnt" koalaman/shellcheck:stable \
	$(SH_FILES) -e SC1071 -e SC2162

##@ Docker

build-docker-dev: ## Build Docker image for development (fast).
	@echo "build development container"
	@echo "\033[92mInfo:\033[0m the frontend code is expected to be built already."
	$(GO) run build.go -goos linux -pkg-arch amd64 ${OPT} build pkg-archive latest
	cp dist/grafana-latest.linux-x64.tar.gz packaging/docker
	cd packaging/docker && docker build --tag grafana/grafana:dev .

build-docker-full: ## Build Docker image for development.
	@echo "build docker container"
	docker build --tag grafana/grafana:dev .

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

help: ## Display this help.
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[1m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)
