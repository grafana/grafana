include ../sdk.mk

.PHONY: etcd
etcd:
	@docker run -d --name etcd --env ALLOW_NONE_AUTHENTICATION=yes -p 22379:2379 bitnamilegacy/etcd:latest

.PHONY: generate # Run Grafana App SDK code generation
generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate \
		--source=./kinds/ \
		--gogenpath=./pkg/apis \
		--grouping=group \
		--defencoding=none

.PHONY: run
run:
	@go run ./pkg/standalone/server.go --etcd-servers=http://127.0.0.1:22379 --secure-port 7445

.PHONY: create-checks
create-checks:
	@echo "Creating plugin check..."
	@curl -k -X POST https://localhost:7445/apis/advisor.grafana.app/v0alpha1/namespaces/stacks-1/checks \
		-H "Content-Type: application/json" \
		-d '{"kind":"Check","apiVersion":"advisor.grafana.app/v0alpha1","spec":{"data":{}},"metadata":{"generateName":"check-","labels":{"advisor.grafana.app/type":"plugin"},"namespace":"stacks-1"},"status":{"report":{"count":0,"failures":[]}}}' \
		&& echo "Plugin check created successfully"
	@echo "Creating datasource check..."
	@curl -k -X POST https://localhost:7445/apis/advisor.grafana.app/v0alpha1/namespaces/stacks-1/checks \
		-H "Content-Type: application/json" \
		-d '{"kind":"Check","apiVersion":"advisor.grafana.app/v0alpha1","spec":{"data":{}},"metadata":{"generateName":"check-","labels":{"advisor.grafana.app/type":"datasource"},"namespace":"stacks-1"},"status":{"report":{"count":0,"failures":[]}}}' \
		&& echo "Datasource check created successfully"

delete-checks:
	@curl -k -X DELETE https://localhost:7445/apis/advisor.grafana.app/v0alpha1/namespaces/stacks-1/checks \
		&& echo "All checks deleted successfully"
