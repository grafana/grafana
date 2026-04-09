include ../sdk.mk

.PHONY: generate # Run Grafana App SDK code generation
generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate --source=./kinds/
	@# Remove generated files for v0alpha1 since it's a thin wrapper around v1
	@rm -f ./pkg/apis/playlist/v0alpha1/playlist_codec_gen.go
	@rm -f ./pkg/apis/playlist/v0alpha1/playlist_object_gen.go
	@rm -f ./pkg/apis/playlist/v0alpha1/playlist_schema_gen.go
	@rm -f ./pkg/apis/playlist/v0alpha1/playlist_spec_gen.go
	@rm -f ./pkg/apis/playlist/v0alpha1/playlist_status_gen.go
	@echo "Removed generated v0alpha1 files (v0alpha1 is a thin wrapper around v1)"
