.ONESHELL:
.DELETE_ON_ERROR:
export SHELL     := bash
export SHELLOPTS := pipefail:errexit
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rule

include docs.mk

.PHONY: sources/panels-visualizations/query-transform-data/transform-data/index.md
sources/panels-visualizations/query-transform-data/transform-data/index.md: ## Generate the Transform Data page source. Create a temporary TypeScript configuration that skips type checking of library files. This avoids errors with third-party type definitions like the Intl.Segmenter issue 
	cd $(CURDIR)/.. && \
	echo '{"compilerOptions":{"skipLibCheck":true,"target":"es2020","module":"commonjs","esModuleInterop":true},"include":["./scripts/docs/generate-transformations.ts"]}' > temp-tsconfig.json && \
	npx tsc -p temp-tsconfig.json && \
	node ./scripts/docs/generate-transformations.js > $(CURDIR)/$@ && \
	chmod +x node_modules/.bin/prettier && \
	npx prettier -w $(CURDIR)/$@ && \
	rm temp-tsconfig.json
