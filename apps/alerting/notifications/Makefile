include ../../sdk.mk

.PHONY: generate
generate: do-generate ## Run Grafana App SDK code generation

.PHONY: do-generate
do-generate: install-app-sdk update-app-sdk
	## --defencoding=none and noschemasinmanifest are needed to avoid infinite loop while generating recursive models (see routingtree.cue)
	@$(APP_SDK_BIN) generate --grouping=group --gogenpath=./pkg/apis --defencoding=none	--postprocess --noschemasinmanifest --useoldmanifestkinds
