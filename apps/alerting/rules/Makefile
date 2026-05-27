include ../../sdk.mk

SPEC_GEN_FILE = pkg/apis/alerting/v0alpha1/alertrule_spec_gen.go

.PHONY: generate
generate: do-generate post-generate ## Run Grafana App SDK code generation

.PHONY: do-generate
do-generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate --source=./kinds/

.PHONY: post-generate
post-generate: ## HACK: This patches the generated code to fall back to SimplifiedRouting as the default notification settings type
	@sed -i.bak '/discriminator, found := parsedAsMap\["type"\]/{n;/if !found {/{n;s/return nil/discriminator = "SimplifiedRouting"/;};};' $(SPEC_GEN_FILE) && rm $(SPEC_GEN_FILE).bak
