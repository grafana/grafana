.ONESHELL:
.DELETE_ON_ERROR:
export SHELL     := bash
export SHELLOPTS := pipefail:errexit
MAKEFLAGS += --warn-undefined-variables
MAKEFLAGS += --no-builtin-rule

include docs.mk

.PHONY: sources/panels-visualizations/query-transform-data/transform-data/index.md
sources/panels-visualizations/query-transform-data/transform-data/index.md: ## Generate the Transform Data page source.
	cd $(CURDIR)/.. && \
	npx tsx ./scripts/docs/generate-transformations.ts && \
	npx prettier -w $(CURDIR)/$@

.PHONY: sources/panels-visualizations/query-transform-data/transform-data/index.md
sources/panels-visualizations/query-transform-data/transform-data/index.md: ## Generate the Transform Data page source.
# Create a temporary TypeScript configuration that skips type checking of library files
# This avoids errors with third-party type definitions like the Intl.Segmenter issue

	cd $(CURDIR)/.. && \
	echo '{"compilerOptions":{"skipLibCheck":true,"target":"es2020","module":"commonjs","esModuleInterop":true},"include":["./scripts/docs/generate-transformations.ts"]}' > temp-tsconfig.json && \

# Compile the TypeScript file using the temporary configuration

	npx tsc -p temp-tsconfig.json && \

# Run the compiled JavaScript and redirect output to the target file

	node ./scripts/docs/generate-transformations.js > $(CURDIR)/$@ && \

# Ensure the prettier binary has execute permissions before running it

	chmod +x node_modules/.bin/prettier && \

# Format the generated markdown file
	npx prettier -w $(CURDIR)/$@ && \

# Clean up the temporary TypeScript configuration

	rm temp-tsconfig.json
