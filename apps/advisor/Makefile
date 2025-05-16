APP_SDK_VERSION := v0.38.1
APP_SDK_DIR     := $(shell go env GOPATH)/bin/app-sdk-$(APP_SDK_VERSION)
APP_SDK_BIN     := $(APP_SDK_DIR)/grafana-app-sdk

.DEFAULT_GOAL := generate

.PHONY: install-app-sdk
install-app-sdk: $(APP_SDK_BIN) ## Install the Grafana App SDK

$(APP_SDK_BIN):
	@echo "Installing Grafana App SDK version $(APP_SDK_VERSION)"
	@mkdir -p $(APP_SDK_DIR)
	# The only way to install specific versions of binaries using `go install`
	# is by setting GOBIN to the directory you want to install the binary to.
	GOBIN=$(APP_SDK_DIR) go install github.com/grafana/grafana-app-sdk/cmd/grafana-app-sdk@$(APP_SDK_VERSION)
	@touch $@

.PHONY: generate
generate: do-generate ## Run Grafana App SDK code generation

.PHONY: do-generate
do-generate: install-app-sdk ## Run Grafana App SDK code generation
	@grafana-app-sdk generate -g ./pkg/apis --grouping=group --postprocess --defencoding=none

