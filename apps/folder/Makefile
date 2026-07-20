include ../sdk.mk

.PHONY: generate
generate: install-app-sdk update-app-sdk ## Run Grafana App SDK code generation
	@$(APP_SDK_BIN) generate --source=./kinds/
	@# The SDK still emits resource jennies for v1beta1 when codegen.go is disabled; remove them (thin wrapper in folder.go).
	@rm -f ./pkg/apis/folder/v1beta1/folder_codec_gen.go
	@rm -f ./pkg/apis/folder/v1beta1/folder_object_gen.go
	@rm -f ./pkg/apis/folder/v1beta1/folder_schema_gen.go
	@rm -f ./pkg/apis/folder/v1beta1/folder_spec_gen.go
	@rm -f ./pkg/apis/folder/v1beta1/folder_client_gen.go
	@echo "Removed generated v1beta1 resource files (v1beta1 is a thin wrapper around v1)"

