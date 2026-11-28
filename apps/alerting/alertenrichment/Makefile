include ../../sdk.mk

SPEC_GEN_FILE = pkg/generated/alertenrichment/v1beta1/alertenrichment_spec_gen.go
MANIFEST_FILE = pkg/generated/manifestdata/alertenrichment_manifest.go

.PHONY: generate # Run Grafana App SDK code generation
generate: do-generate post-generate

.PHONY: do-generate
do-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate --source=./kinds/

# Restores schema details of the hand-written types that cog cannot express in CUE.
.PHONY: post-generate
post-generate:
	@go run ./scripts/patchgen $(SPEC_GEN_FILE) $(MANIFEST_FILE)
