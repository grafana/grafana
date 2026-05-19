include ../../sdk.mk

SPEC_GEN_FILE = pkg/apis/alerting/v0alpha1/alertrule_spec_gen.go

.PHONY: generate
generate: do-generate ## Run Grafana App SDK code generation

.PHONY: do-generate
do-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate --source=./kinds/
