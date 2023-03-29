# Auto generated binary variables helper managed by https://github.com/bwplotka/bingo v0.8. DO NOT EDIT.
# All tools are designed to be build inside $GOBIN.
BINGO_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
GOPATH ?= $(shell go env GOPATH)
GOBIN  ?= $(firstword $(subst :, ,${GOPATH}))/bin
GO     ?= $(shell which go)

# Below generated variables ensure that every time a tool under each variable is invoked, the correct version
# will be used; reinstalling only if needed.
# For example for bra variable:
#
# In your main Makefile (for non array binaries):
#
#include .bingo/Variables.mk # Assuming -dir was set to .bingo .
#
#command: $(BRA)
#	@echo "Running bra"
#	@$(BRA) <flags/args..>
#
BRA := $(GOBIN)/bra-v0.0.0-20200517080246-1e3013ecaff8
$(BRA): $(BINGO_DIR)/bra.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/bra-v0.0.0-20200517080246-1e3013ecaff8"
	@cd $(BINGO_DIR) && GOWORK=off $(GO) build -mod=mod -modfile=bra.mod -o=$(GOBIN)/bra-v0.0.0-20200517080246-1e3013ecaff8 "github.com/unknwon/bra"

DRONE := $(GOBIN)/drone-v1.5.0
$(DRONE): $(BINGO_DIR)/drone.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/drone-v1.5.0"
	@cd $(BINGO_DIR) && GOWORK=off $(GO) build -mod=mod -modfile=drone.mod -o=$(GOBIN)/drone-v1.5.0 "github.com/drone/drone-cli/drone"

GOLANGCI_LINT := $(GOBIN)/golangci-lint-v1.51.2
$(GOLANGCI_LINT): $(BINGO_DIR)/golangci-lint.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/golangci-lint-v1.51.2"
	@cd $(BINGO_DIR) && GOWORK=off $(GO) build -mod=mod -modfile=golangci-lint.mod -o=$(GOBIN)/golangci-lint-v1.51.2 "github.com/golangci/golangci-lint/cmd/golangci-lint"

JB := $(GOBIN)/jb-v0.5.1
$(JB): $(BINGO_DIR)/jb.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/jb-v0.5.1"
	@cd $(BINGO_DIR) && GOWORK=off $(GO) build -mod=mod -modfile=jb.mod -o=$(GOBIN)/jb-v0.5.1 "github.com/jsonnet-bundler/jsonnet-bundler/cmd/jb"

SWAGGER := $(GOBIN)/swagger-v0.30.2
$(SWAGGER): $(BINGO_DIR)/swagger.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/swagger-v0.30.2"
	@cd $(BINGO_DIR) && GOWORK=off $(GO) build -mod=mod -modfile=swagger.mod -o=$(GOBIN)/swagger-v0.30.2 "github.com/go-swagger/go-swagger/cmd/swagger"

WIRE := $(GOBIN)/wire-v0.5.0
$(WIRE): $(BINGO_DIR)/wire.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/wire-v0.5.0"
	@cd $(BINGO_DIR) && GOWORK=off $(GO) build -mod=mod -modfile=wire.mod -o=$(GOBIN)/wire-v0.5.0 "github.com/google/wire/cmd/wire"

