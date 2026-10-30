TOOLS_DIR ?= $(shell go env GOPATH)/bin/proxydb-v1-tools
BUF := $(TOOLS_DIR)/buf

.PHONY: provision-tools generate check-generated check-tools proto-lint proto-breaking

provision-tools:
	@mkdir -p "$(TOOLS_DIR)"
	@if [ ! -x "$(BUF)" ] || [ "$$($(BUF) --version)" != 1.73.0 ]; then \
		GOBIN="$(TOOLS_DIR)" go install github.com/bufbuild/buf/cmd/buf@v1.73.0; \
	fi
	@if [ ! -x "$(TOOLS_DIR)/protoc-gen-go" ] || [ "$$($(TOOLS_DIR)/protoc-gen-go --version)" != 'protoc-gen-go v1.36.11' ]; then \
		GOBIN="$(TOOLS_DIR)" go install google.golang.org/protobuf/cmd/protoc-gen-go@v1.36.11; \
	fi
	@if [ ! -x "$(TOOLS_DIR)/protoc-gen-go-grpc" ] || [ "$$($(TOOLS_DIR)/protoc-gen-go-grpc --version)" != 'protoc-gen-go-grpc 1.6.2' ]; then \
		GOBIN="$(TOOLS_DIR)" go install google.golang.org/grpc/cmd/protoc-gen-go-grpc@v1.6.2; \
	fi

check-tools: provision-tools
	@test "$$($(BUF) --version)" = 1.73.0
	@test "$$($(TOOLS_DIR)/protoc-gen-go --version)" = 'protoc-gen-go v1.36.11'
	@test "$$($(TOOLS_DIR)/protoc-gen-go-grpc --version)" = 'protoc-gen-go-grpc 1.6.2'

generate: check-tools
	PATH="$(TOOLS_DIR):$$PATH" $(BUF) generate proto --template buf.gen.yaml

proto-lint: check-tools
	$(BUF) format proto --diff --exit-code
	$(BUF) lint proto

proto-breaking: check-tools
	@test -n "$(PROTO_BASE)" || (echo 'Set PROTO_BASE to the baseline schema directory'; exit 1)
	$(BUF) breaking proto --against "$(PROTO_BASE)"

check-generated: check-tools
	@set -eu; tmp=$$(mktemp -d); trap 'rm -rf "$$tmp"' EXIT; \
	PATH="$(TOOLS_DIR):$$PATH" $(BUF) generate proto --template buf.gen.yaml --output "$$tmp"; \
	diff -u api/dbproxy/v1/query.pb.go "$$tmp/api/dbproxy/v1/query.pb.go"; \
	diff -u api/dbproxy/v1/query_grpc.pb.go "$$tmp/api/dbproxy/v1/query_grpc.pb.go"
