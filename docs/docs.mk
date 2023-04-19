include variables.mk
-include variables.mk.local

.ONESHELL:
.DELETE_ON_ERROR:
export SHELL     := bash
export SHELLOPTS := pipefail:errexit
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rule

.DEFAULT_GOAL: help

# Adapted from https://www.thapaliya.com/en/writings/well-documented-makefiles/
.PHONY: help
help: ## Display this help.
help:
	@awk 'BEGIN {FS = ": ##"; printf "Usage:\n  make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_\.\-\/%]+: ##/ { printf "  %-45s %s\n", $$1, $$2 }' $(MAKEFILE_LIST)

GIT_ROOT := $(shell git rev-parse --show-toplevel)

PODMAN := $(shell if command -v podman >/dev/null 2>&1; then echo podman; else echo docker; fi)

ifeq ($(PROJECTS),)
$(error "PROJECTS variable must be defined in variables.mk")
endif

# First project is considered the primary one used for doc-validator.
PRIMARY_PROJECT := $(firstword $(subst /,-,$(PROJECTS)))

# Name for the container.
export DOCS_CONTAINER := $(PRIMARY_PROJECT)-docs

# Host port to publish container port to.
export DOCS_HOST_PORT := 3002

# Container image used to perform Hugo build.
export DOCS_IMAGE := grafana/docs-base:latest

# Container image used for doc-validator linting.
export DOC_VALIDATOR_IMAGE := grafana/doc-validator:latest

# PATH-like list of directories within which to find projects.
# If all projects are checked out into the same directory, ~/repos/ for example, then the default should work.
export REPOS_PATH := $(realpath $(GIT_ROOT)/..)

# How to treat Hugo relref errors.
export HUGO_REFLINKSERRORLEVEL := WARNING

.PHONY: docs-rm
docs-rm: ## Remove the docs container.
	$(PODMAN) rm -f $(DOCS_CONTAINER)

.PHONY: docs-pull
docs-pull: ## Pull documentation base image.
	$(PODMAN) pull $(DOCS_IMAGE)

make-docs: ## Fetch the latest make-docs script.
make-docs:
	curl -s -LO https://raw.githubusercontent.com/grafana/writers-toolkit/main/scripts/make-docs
	chmod +x make-docs

.PHONY: docs
docs: ## Serve documentation locally.
docs: docs-pull make-docs
	$(PWD)/make-docs $(PROJECTS)

.PHONY: docs-no-pull
docs-no-pull: ## Serve documentation locally without pulling the latest docs-base image.
docs-no-pull: make-docs
	$(PWD)/make-docs $(PROJECTS)

.PHONY: doc-validator
doc-validator: ## Run docs-validator on the entire docs folder.
	DOCS_IMAGE=$(DOC_VALIDATOR_IMAGE) $(PWD)/make-docs $(PROJECTS)

.PHONY: doc-validator/%
doc-validator/%: ## Run doc-validator on a specific path. To lint the path /docs/sources/administration, run 'make doc-validator/administration'.
doc-validator/%:
	DOCS_IMAGE=$(DOC_VALIDATOR_IMAGE) DOC_VALIDATOR_INCLUDE=$(subst doc-validator/,,$@) $(PWD)/make-docs $(PROJECTS)

docs.mk: ## Fetch the latest version of this Makefile from Writers' Toolkit.
	curl -s -LO https://raw.githubusercontent.com/grafana/writers-toolkit/main/docs/docs.mk
