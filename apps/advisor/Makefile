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
