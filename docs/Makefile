.PHONY: all default docs docs-build docs-shell shell checkvars

# to allow `make DOCSPORT=9000 docs`
DOCSPORT := 3004

DOCKER_DOCS_IMAGE := grafana/grafana-docs
SOURCES_HOST_DIR := "$(shell pwd)/sources"

# assuming grafana and grafana.org-repo to be checked out in the same folder
DEFAULT_LAYOUTS_DIR := "$(shell pwd)/../../../../../../grafana.org/layouts"

# to allow `make DOCSDIR=docs docs-shell` (to create a bind mount in docs)
LAYOUTS_MOUNT := $(if $(LAYOUTS),-v $(DEFAULT_LAYOUTS_DIR):/site/layouts)
DOCS_MOUNT := -v $(SOURCES_HOST_DIR):/site/content

DOCKER_RUN_DOCS := docker run --rm -it $(DOCS_MOUNT) $(LAYOUTS_MOUNT) -e NOCACHE -p 3004:3004 -p 3005:3005

VERSION := $(shell head -n 1 VERSION)

default: docs

checkvars:
ifndef ENV
	$(error ENV is undefined set via ENV=staging or ENV=prod as argument to make)
endif

docs: docs-build
	$(DOCKER_RUN_DOCS) $(DOCS_MOUNT) -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "grunt --env=dev-docs && grunt connect --port=3004"

watch: docs-build
	$(DOCKER_RUN_DOCS) $(DOCS_MOUNT) $(LAYOUTS_MOUNT) -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "grunt --env=dev-docs && grunt connect --port=3004 & grunt watch --port=3004 --env=dev-docs"

publish: checkvars docs-build
	$(info Publishing ENV=${ENV} and VERSION=${VERSION})
	$(DOCKER_RUN_DOCS) $(DOCS_MOUNT) -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "./publish.sh ${ENV}-docs ${VERSION}"

docs-build:
	docker build -t "$(DOCKER_DOCS_IMAGE)" --no-cache .
