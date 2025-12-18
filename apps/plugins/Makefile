include ../sdk.mk

.PHONY: internal-generate # Run Grafana App SDK code generation
internal-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--defencoding=none

.PHONY: generate
generate: internal-generate # makes all files declaration files so they don't mess with the exported types in @grafana/runtime
	rm -f ./plugin/src/generated/meta/v0alpha1/*.d.ts
	rm -f ./plugin/src/generated/plugin/v0alpha1/*.d.ts
	for f in ./plugin/src/generated/meta/v0alpha1/*.ts; do mv "$$f" "$${f%.ts}.d.ts"; done
	for f in ./plugin/src/generated/plugin/v0alpha1/*.ts; do mv "$$f" "$${f%.ts}.d.ts"; done
