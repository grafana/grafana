include ../sdk.mk

OPERATOR_DOCKERIMAGE := "github.com/grafana/grafana/apps/iam/operator"

.PHONY: generate
generate: install-app-sdk update-app-sdk ## Run Grafana App SDK code generation
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--defencoding=none \
		--noschemasinmanifest \
		--postprocess \

.PHONY: deps
deps:
	@go mod tidy
	@go work vendor

.PHONY: build
build: build/operator

.PHONY: build/operator
build/operator:
	docker build -t $(OPERATOR_DOCKERIMAGE) -f cmd/operator/Dockerfile .

.PHONY: local/up
local/up: 
	@./local/scripts/cluster.sh create "local/generated/k3d-config.json"
	@cd local && tilt up

.PHONY: local/generate
local/generate:
	@grafana-app-sdk project local generate

.PHONY: local/down
local/down:
	@cd local && tilt down

.PHONY: local/deploy_plugin
local/deploy_plugin:
	-tilt disable grafana
	cp -R plugin/dist local/mounted-files/plugin/dist
	-tilt enable grafana

.PHONY: local/push_operator
local/push_operator:
	# Tag the docker image as part of localhost, which is what the generated k8s uses to avoid confusion with the real operator image
	@docker tag "$(OPERATOR_DOCKERIMAGE):latest" "localhost/$(OPERATOR_DOCKERIMAGE):latest"
	@./local/scripts/push_image.sh "localhost/$(OPERATOR_DOCKERIMAGE):latest"

.PHONY: local/clean
local/clean: local/down
	@./local/scripts/cluster.sh delete