include ../../sdk.mk

.PHONY: generate
generate: do-generate ## Run Grafana App SDK code generation

.PHONY: do-generate
do-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate --grouping=group --gogenpath=./pkg/apis --defencoding=yaml --postprocess
