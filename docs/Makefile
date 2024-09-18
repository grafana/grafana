.ONESHELL:
.DELETE_ON_ERROR:
export SHELL     := bash
export SHELLOPTS := pipefail:errexit
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rule

include docs.mk

.PHONY: sources/panels-visualizations/query-transform-data/transform-data/index.md
sources/panels-visualizations/query-transform-data/transform-data/index.md: ## Generate the Transform Data page source.
	cd $(CURDIR)/.. && npx tsc ./scripts/docs/generate-transformations.ts && \
	node -e "require('./scripts/docs/generate-transformations').buildMarkdownContent()" && \
	npx prettier -w $(CURDIR)/$@
