APP_SDK_VERSION := v0.35.0
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

.PHONY: generate
generate: install-app-sdk update-app-sdk ## Run Grafana App SDK code generation
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--tsgenpath=../../packages/grafana-schema/src/schema \
		--grouping=group \
		--defencoding=none \
		--genoperatorstate=false \
		--noschemasinmanifest

	# This is a workaround for SDK codegen not producing correct output for v0alpha1
	@rm ../../packages/grafana-schema/src/schema/dashboard/v0alpha1/types.spec.gen.ts
	@cp ./tshack/v0alpha1_spec_gen.ts ../../packages/grafana-schema/src/schema/dashboard/v0alpha1/types.spec.gen.ts

	# Same for v1alpha1
	@rm ../../packages/grafana-schema/src/schema/dashboard/v1alpha1/types.spec.gen.ts
	@cp ./tshack/v1alpha1_spec_gen.ts ../../packages/grafana-schema/src/schema/dashboard/v1alpha1/types.spec.gen.ts
