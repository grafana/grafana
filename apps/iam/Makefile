include ../sdk.mk

OPERATOR_DOCKERIMAGE := "iam"

.PHONY: generate
generate: install-app-sdk update-app-sdk ## Run Grafana App SDK code generation
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--defencoding=none \
		--noschemasinmanifest \
		--postprocess \

.PHONY: build
build: build/operator

.PHONY: build/operator
build/operator:
	docker build -t $(OPERATOR_DOCKERIMAGE) -f cmd/operator/Dockerfile .