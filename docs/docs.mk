# The source of this file is https://raw.githubusercontent.com/grafana/writers-toolkit/main/docs/docs.mk.
# A changelog is included in the head of the `make-docs` script.
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
	@awk 'BEGIN { \
		FS = ": ##"; \
		printf "Usage:\n  make <target>\n\nTargets:\n" \
	} \
	/^[a-zA-Z0-9_\.\-\/%]+: ##/ { printf "  %-15s %s\n", $$1, $$2 }' \
	$(MAKEFILE_LIST)

GIT_ROOT := $(shell git rev-parse --show-toplevel)

PODMAN := $(shell if command -v podman >/dev/null 2>&1; then echo podman; else echo docker; fi)

ifeq ($(PROJECTS),)
$(error "PROJECTS variable must be defined in variables.mk")
endif

# First project is considered the primary one used for doc-validator.
PRIMARY_PROJECT := $(subst /,-,$(firstword $(subst :, ,$(firstword $(PROJECTS)))))

# Host port to publish container port to.
ifeq ($(origin DOCS_HOST_PORT), undefined)
export DOCS_HOST_PORT := 3002
endif

# Container image used to perform Hugo build.
ifeq ($(origin DOCS_IMAGE), undefined)
export DOCS_IMAGE := grafana/docs-base:latest
endif

# Container image used for doc-validator linting.
ifeq ($(origin DOC_VALIDATOR_IMAGE), undefined)
export DOC_VALIDATOR_IMAGE := grafana/doc-validator:latest
endif

# Container image used for vale linting.
ifeq ($(origin VALE_IMAGE), undefined)
export VALE_IMAGE := grafana/vale:latest
endif

# PATH-like list of directories within which to find projects.
# If all projects are checked out into the same directory, ~/repos/ for example, then the default should work.
ifeq ($(origin REPOS_PATH), undefined)
export REPOS_PATH := $(realpath $(GIT_ROOT)/..)
endif

# How to treat Hugo relref errors.
ifeq ($(origin HUGO_REFLINKSERRORLEVEL), undefined)
export HUGO_REFLINKSERRORLEVEL := WARNING
endif

.PHONY: docs-rm
docs-rm: ## Remove the docs container.
	$(PODMAN) rm -f $(DOCS_CONTAINER)

.PHONY: docs-pull
docs-pull: ## Pull documentation base image.
	$(PODMAN) pull -q $(DOCS_IMAGE)

make-docs: ## Fetch the latest make-docs script.
make-docs:
	if [[ ! -f "$(CURDIR)/make-docs" ]]; then
		echo 'WARN: No make-docs script found in the working directory. Run `make update` to download it.' >&2
		exit 1
	fi

.PHONY: docs
docs: ## Serve documentation locally, which includes pulling the latest `DOCS_IMAGE` (default: `grafana/docs-base:latest`) container image. See also `docs-no-pull`.
docs: docs-pull make-docs
	$(CURDIR)/make-docs $(PROJECTS)

.PHONY: docs-no-pull
docs-no-pull: ## Serve documentation locally without pulling the `DOCS_IMAGE` (default: `grafana/docs-base:latest`) container image.
docs-no-pull: make-docs
	$(CURDIR)/make-docs $(PROJECTS)

.PHONY: docs-debug
docs-debug: ## Run Hugo web server with debugging enabled. TODO: support all SERVER_FLAGS defined in website Makefile.
docs-debug: make-docs
	WEBSITE_EXEC='hugo server --bind 0.0.0.0 --port 3002 --debug' $(CURDIR)/make-docs $(PROJECTS)

.PHONY: doc-validator
doc-validator: ## Run doc-validator on the entire docs folder.
doc-validator: make-docs
	DOCS_IMAGE=$(DOC_VALIDATOR_IMAGE) $(CURDIR)/make-docs $(PROJECTS)

.PHONY: vale
vale: ## Run vale on the entire docs folder.
vale: make-docs
	DOCS_IMAGE=$(VALE_IMAGE) $(CURDIR)/make-docs $(PROJECTS)

.PHONY: update
update: ## Fetch the latest version of this Makefile and the `make-docs` script from Writers' Toolkit.
	curl -s -LO https://raw.githubusercontent.com/grafana/writers-toolkit/main/docs/docs.mk
	curl -s -LO https://raw.githubusercontent.com/grafana/writers-toolkit/main/docs/make-docs
	chmod +x make-docs
