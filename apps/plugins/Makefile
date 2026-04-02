include ../sdk.mk

.PHONY: internal-generate # Run Grafana App SDK code generation
internal-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate --source=./kinds/

.PHONY: generate
generate: internal-generate # copy files to packages/grafana-runtime/src/services/pluginMeta/types
	rm -f ./packages/grafana-runtime/src/services/pluginMeta/types/meta/*.ts 
	rm -f ./packages/grafana-runtime/src/services/pluginMeta/types/plugin/*.ts 
	cp plugin/src/generated/meta/v0alpha1/meta_object_gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/meta/meta_object_gen.ts
	cp plugin/src/generated/meta/v0alpha1/types.spec.gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/meta/types.spec.gen.ts
	cp plugin/src/generated/meta/v0alpha1/types.status.gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/meta/types.status.gen.ts
	cp plugin/src/generated/plugin/v0alpha1/plugin_object_gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/plugin/plugin_object_gen.ts
	cp plugin/src/generated/plugin/v0alpha1/types.metadata.gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/plugin/types.metadata.gen.ts
	cp plugin/src/generated/plugin/v0alpha1/types.spec.gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/plugin/types.spec.gen.ts
	cp plugin/src/generated/plugin/v0alpha1/types.status.gen.ts ../../packages/grafana-runtime/src/services/pluginMeta/types/plugin/types.status.gen.ts
