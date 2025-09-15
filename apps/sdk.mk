APP_SDK_VERSION = v0.43.2
APP_SDK_DIR     = $(shell go env GOPATH)/bin/app-sdk-$(APP_SDK_VERSION)
APP_SDK_BIN     = $(APP_SDK_DIR)/grafana-app-sdk


.PHONY: install-app-sdk
install-app-sdk: echodir $(APP_SDK_BIN) ## Install the Grafana App SDK

.PHONY: echodir

$(APP_SDK_BIN):
	@echo "Installing Grafana App SDK version $(APP_SDK_VERSION)"
	@mkdir -p $(APP_SDK_DIR)
	# The only way to install specific versions of binaries using `go install`
	# is by setting GOBIN to the directory you want to install the binary to.
	GOBIN=$(APP_SDK_DIR) go install github.com/grafana/grafana-app-sdk/cmd/grafana-app-sdk@$(APP_SDK_VERSION)
	@touch $@

.PHONY: update-app-sdk
update-app-sdk: ## Update the Grafana App SDK dependency in go.mod
	@pwd
	go get github.com/grafana/grafana-app-sdk@$(APP_SDK_VERSION)
	go mod tidy
