APP_SDK_VERSION := v0.35.1
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
generate: do-generate post-generate-cleanup ## Run Grafana App SDK code generation

.PHONY: do-generate
do-generate: install-app-sdk update-app-sdk ## Run Grafana App SDK code generation
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--tsgenpath=../../packages/grafana-schema/src/schema \
		--grouping=group \
		--defencoding=none \
		--genoperatorstate=false \
		--noschemasinmanifest

.PHONY: post-generate-cleanup
post-generate-cleanup: ## Clean up the generated code
	# This is a workaround for SDK codegen not producing correct output for v0alpha1
	@rm ../../packages/grafana-schema/src/schema/dashboard/v0alpha1/types.spec.gen.ts
	@cp ./tshack/v0alpha1_spec_gen.ts ../../packages/grafana-schema/src/schema/dashboard/v0alpha1/types.spec.gen.ts

	# Same for v1alpha1
	@rm ../../packages/grafana-schema/src/schema/dashboard/v1beta1/types.spec.gen.ts
	@cp ./tshack/v1alpha1_spec_gen.ts ../../packages/grafana-schema/src/schema/dashboard/v1beta1/types.spec.gen.ts

	# Remove auto-generated DeepCopy and DeepCopyInto methods for Spec for v0alpha1.
	@sed -e '/\/\/ DeepCopy creates a full deep copy of Spec/,+5d' ./pkg/apis/dashboard/v0alpha1/dashboard_object_gen.go > ./pkg/apis/dashboard/v0alpha1/dashboard_object_gen.go.tmp
	@sed -e '/\/\/ DeepCopyInto deep copies Spec into another Spec object/,+3d' ./pkg/apis/dashboard/v0alpha1/dashboard_object_gen.go.tmp > ./pkg/apis/dashboard/v0alpha1/dashboard_object_gen.go.tmp2
	@rm ./pkg/apis/dashboard/v0alpha1/dashboard_object_gen.go.tmp
	@mv ./pkg/apis/dashboard/v0alpha1/dashboard_object_gen.go.tmp2 ./pkg/apis/dashboard/v0alpha1/dashboard_object_gen.go

	# Remove auto-generated DeepCopy and DeepCopyInto methods for Spec for v1alpha1.
	@sed -e '/\/\/ DeepCopy creates a full deep copy of Spec/,+5d' ./pkg/apis/dashboard/v1beta1/dashboard_object_gen.go > ./pkg/apis/dashboard/v1beta1/dashboard_object_gen.go.tmp
	@sed -e '/\/\/ DeepCopyInto deep copies Spec into another Spec object/,+3d' ./pkg/apis/dashboard/v1beta1/dashboard_object_gen.go.tmp > ./pkg/apis/dashboard/v1beta1/dashboard_object_gen.go.tmp2
	@rm ./pkg/apis/dashboard/v1beta1/dashboard_object_gen.go.tmp
	@mv ./pkg/apis/dashboard/v1beta1/dashboard_object_gen.go.tmp2 ./pkg/apis/dashboard/v1beta1/dashboard_object_gen.go

	# Copy dashboard/v2alpha1 spec so we can use it for schema validation
	@echo "// This file is managed by grafana-app-sdk - DO NOT EDIT MANUALLY" > ./pkg/apis/dashboard/v2alpha1/dashboard_spec.cue
	@echo "// Source: apps/dashboard/kinds/v2alpha1/dashboard_spec.cue" >> ./pkg/apis/dashboard/v2alpha1/dashboard_spec.cue
	@echo "// To sync changes, run: make generate in apps/dashboard" >> ./pkg/apis/dashboard/v2alpha1/dashboard_spec.cue
	@echo "" >> ./pkg/apis/dashboard/v2alpha1/dashboard_spec.cue
	@cat ./kinds/v2alpha1/dashboard_spec.cue >> ./pkg/apis/dashboard/v2alpha1/dashboard_spec.cue
