# Auto generated binary variables helper managed by https://github.com/bwplotka/bingo v0.9. DO NOT EDIT.
# All tools are designed to be build inside $GOBIN.
BINGO_DIR := $(dir $(lastword $(MAKEFILE_LIST)))
GOPATH ?= $(shell go env GOPATH)
GOBIN  ?= $(firstword $(subst :, ,${GOPATH}))/bin
GO     ?= $(shell which go)

# Below generated variables ensure that every time a tool under each variable is invoked, the correct version
# will be used; reinstalling only if needed.
# For example for drone variable:
#
# In your main Makefile (for non array binaries):
#
#include .bingo/Variables.mk # Assuming -dir was set to .bingo .
#
#command: $(DRONE)
#	@echo "Running drone"
#	@$(DRONE) <flags/args..>
#
DRONE := $(GOBIN)/drone-v1.5.0
$(DRONE): $(BINGO_DIR)/drone.mod
	@# Install binary/ries using Go 1.14+ build command. This is using bwplotka/bingo-controlled, separate go module with pinned dependencies.
	@echo "(re)installing $(GOBIN)/drone-v1.5.0"
	@cd $(BINGO_DIR) && GOWORK=off CGO_ENABLED=0 $(GO) build -mod=mod -modfile=drone.mod -o=$(GOBIN)/drone-v1.5.0 "github.com/drone/drone-cli/drone"

