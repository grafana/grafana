.PHONY: all default docs docs-build docs-shell shell test

# to allow `make DOCSPORT=9000 docs`
DOCSPORT := 3004

DOCKER_DOCS_IMAGE := grafana/grafana-docs

SOURCES_HOST_DIR := "$(shell pwd)/sources"

DOCS_MOUNT := -v $(SOURCES_HOST_DIR):/site/content

DOCKER_RUN_DOCS := docker run --rm -it $(DOCS_MOUNT) -e NOCACHE -p 3004:3004 -p 3005:3005


default: docs

docs: docs-build
	$(DOCKER_RUN_DOCS) $(DOCS_MOUNT) -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "grunt --env=dev-docs && grunt connect --port=3004"

test: docs-build
	$(DOCKER_RUN_DOCS) $(DOCS_MOUNT) -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "ls -la /site/content"

docs-watch: docs-build
	$(DOCKER_RUN_DOCS) $(DOCS_MOUNT) -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "grunt --env=dev-docs && grunt connect --port=3004 & grunt watch --port=3004 --env=dev-docs"

publish: docs-build
	$(DOCKER_RUN_DOCS) $(DOCS_MOUNT) -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "./publish.sh staging-docs root"

publish-prod: docs-build
	$(DOCKER_RUN_DOCS) $(DOCS_MOUNT) -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "./publish.sh prod-docs root"

docs-build:
	docker build -t "$(DOCKER_DOCS_IMAGE)" --no-cache .
