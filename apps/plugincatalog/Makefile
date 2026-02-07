include ../sdk.mk

.PHONY: generate
generate: internal-generate

.PHONY: internal-generate
internal-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--defencoding=none
