include ../sdk.mk

.PHONY: generate
generate: install-app-sdk update-app-sdk ## Run Grafana App SDK code generation
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--defencoding=none \
		--noschemasinmanifest \
		--postprocess

.PHONY: deps
deps:
	@go mod tidy
	@GOWORK=off go mod vendor

.PHONY: local/up
local/up:
	@tilt up

.PHONY: local/generate
local/generate:
	@grafana-app-sdk project local generate

.PHONY: local/down
local/down:
	@tilt down
