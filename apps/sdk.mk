APP_SDK_VERSION := apiserver-custom-routes
APP_SDK_DIR     := $(shell go env GOPATH)/bin/app-sdk-$(APP_SDK_VERSION)
APP_SDK_BIN     := $(APP_SDK_DIR)/grafana-app-sdk

APP_SDK_REPO 	:= $(shell go env GOPATH)/src/github.com/grafana/grafana-app-sdk

.PHONY: install-app-sdk
install-app-sdk: $(APP_SDK_BIN) ## Install the Grafana App SDK

$(APP_SDK_BIN):
	@echo "Installing Grafana App SDK version $(APP_SDK_VERSION)"
	@mkdir -p $(APP_SDK_DIR)
	# The only way to install specific versions of binaries using `go install`
	# is by setting GOBIN to the directory you want to install the binary to.
	GOBIN=$(APP_SDK_DIR) go install $(APP_SDK_REPO)/cmd/grafana-app-sdk
	@touch $@

.PHONY: update-app-sdk
update-app-sdk: ## Update the Grafana App SDK dependency in go.mod
	# go get github.com/grafana/grafana-app-sdk@$(APP_SDK_VERSION)
	go mod tidy
