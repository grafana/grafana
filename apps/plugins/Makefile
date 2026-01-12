include ../sdk.mk

.PHONY: internal-generate # Run Grafana App SDK code generation
internal-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--defencoding=none

.PHONY: generate
generate: internal-generate # copy files to packages/grafana-runtime/src/services/pluginMeta/types
	rm -f ./packages/grafana-runtime/src/services/pluginMeta/types/*.ts 
	cp plugin/src/generated/meta/v0alpha1/meta_object_gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/meta_object_gen.ts
	cp plugin/src/generated/meta/v0alpha1/types.spec.gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/types.spec.gen.ts
	cp plugin/src/generated/meta/v0alpha1/types.status.gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/types.status.gen.ts