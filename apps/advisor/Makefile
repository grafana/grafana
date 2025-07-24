include ../sdk.mk

.PHONY: generate
generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate -g ./pkg/apis --grouping=group --postprocess --defencoding=none --useoldmanifestkinds
