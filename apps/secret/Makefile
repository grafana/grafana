APP_SDK_VERSION := v0.39.2
APP_SDK_DIR     := $(shell go env GOPATH)/bin/app-sdk-$(APP_SDK_VERSION)
APP_SDK_BIN     := $(APP_SDK_DIR)/grafana-app-sdk

.PHONY: install-app-sdk
install-app-sdk: $(APP_SDK_BIN) ## Install the Grafana App SDK

$(APP_SDK_BIN):
	@echo "Installing Grafana App SDK version $(APP_SDK_VERSION)"
	@mkdir -p $(APP_SDK_DIR)
	# The only way to install specific versions of binaries using `go install`
	# is by setting GOBIN to the directory you want to install the binary to.
	GOBIN=$(APP_SDK_DIR) go install github.com/grafana/grafana-app-sdk/cmd/grafana-app-sdk@$(APP_SDK_VERSION)
	@touch $@

.PHONY: update-app-sdk
update-app-sdk: ## Update the Grafana App SDK dependency in go.mod
	go get github.com/grafana/grafana-app-sdk@$(APP_SDK_VERSION)
	go mod tidy

.PHONY: generate-app-sdk
generate-app-sdk: install-app-sdk update-app-sdk ## Run Grafana App SDK code generation
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--defencoding=none \
		--noschemasinmanifest \
		--postprocess

.PHONY: override-secure-value-type
override-secure-value-type: ## Override the SecureValueExposedSecureValue type with the common.RawSecureValue type
	go run scripts/override_secure_value_type.go SecureValueExposedSecureValue ./pkg/apis/secret/v1beta1

.PHONY: generate
generate: generate-app-sdk override-secure-value-type
