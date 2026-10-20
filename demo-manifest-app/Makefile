.PHONY: build build-frontend build-backend generate test

# The plugin is its own Go module, outside the repository's go.work.
export GOWORK = off

build: build-frontend build-backend ## Build the plugin into dist/, where Grafana loads it from

node_modules: package.json package-lock.json
	npm ci
	@touch node_modules

build-frontend: node_modules
	npm run build

build-backend:
	mage -v build:linux

generate: node_modules ## Regenerate code and the manifest from kinds/
	npm run generate:kinds

test: node_modules
	go test ./pkg/...
	npm run typecheck
	npm run lint
