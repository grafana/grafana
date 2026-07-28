include ../sdk.mk

.PHONY: generate # Run Grafana App SDK code generation
generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate --source=./kinds/

	@# Remove generated files for v1alpha1 since it's a thin wrapper around v1
	@rm -f ./pkg/apis/preferences/v1alpha1/preferences_client_gen.go
	@rm -f ./pkg/apis/preferences/v1alpha1/preferences_codec_gen.go
	@rm -f ./pkg/apis/preferences/v1alpha1/preferences_object_gen.go
	@rm -f ./pkg/apis/preferences/v1alpha1/preferences_schema_gen.go
	@rm -f ./pkg/apis/preferences/v1alpha1/preferences_spec_gen.go
	@echo "Removed generated v1alpha1 files (v1alpha1 is a thin wrapper around v1)"
