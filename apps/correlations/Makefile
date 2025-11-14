include ../sdk.mk

.PHONY: generate # Run Grafana App SDK code generation
generate: do-generate post-generate-cleanup

.PHONY: do-generate
do-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--genoperatorstate=false \
		--defencoding=none

.PHONY: post-generate-cleanup
post-generate-cleanup: ## Fix TargetSpec OpenAPI schema
	# Fix the TargetSpec schema in manifest - remove nested additionalProperties
	@sed -i.bak 's|"TargetSpec":{"additionalProperties":{"additionalProperties":{},"type":"object"},"type":"object"}|"TargetSpec":{"additionalProperties":{},"type":"object"}|g' ./pkg/apis/correlation_manifest.go && rm ./pkg/apis/correlation_manifest.go.bak