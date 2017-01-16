.PHONY: all default docs docs-build docs-shell shell test
# to allow `make DOCSDIR=1 docs-shell` (to create a bind mount in docs)
DOCS_MOUNT := $(if $(DOCSDIR),-v $(CURDIR):/docs/content/grafana/)

# to allow `make DOCSPORT=9000 docs`
DOCSPORT := 3004

# Get the IP ADDRESS
DOCKER_IP=$(shell python -c "import urlparse ; print urlparse.urlparse('$(DOCKER_HOST)').hostname or ''")
HUGO_BASE_URL=$(shell test -z "$(DOCKER_IP)" && echo localhost || echo "$(DOCKER_IP)")
HUGO_BIND_IP=0.0.0.0

GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null)
GIT_BRANCH_CLEAN := $(shell echo $(GIT_BRANCH) | sed -e "s/[^[:alnum:]]/-/g")
DOCKER_DOCS_IMAGE := grafana/grafana-docs

DOCKER_RUN_DOCS := docker run --rm -it $(DOCS_MOUNT) -e AWS_S3_BUCKET -e NOCACHE
SOURCES_HOST_DIR := "$(shell pwd)/sources"

# for some docs workarounds (see below in "docs-build" target)
GITCOMMIT := $(shell git rev-parse --short HEAD 2>/dev/null)

default: docs

docs: docs-build
	$(DOCKER_RUN_DOCS) -p 3004:3004 -p 3005:3005 -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "grunt && grunt connect --port=3004"

docs-watch: docs-build
	$(DOCKER_RUN_DOCS) -p 3004:3004 -p 3005:3005 -v $(SOURCES_HOST_DIR):/site/content -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "grunt --env=dev-docs && grunt connect --port=3004 & grunt watch --port=3004 --env=dev-docs"

docs-watch-mac: docs-build
	$(DOCKER_RUN_DOCS) -p 3004:3004 -p 3005:3005 -v $(SOURCES_HOST_DIR):/site/content -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "grunt --env=dev-docs-mac && grunt connect --port=3004 & grunt watch --port=3004 --env=dev-docs-mac"

publish: docs-build
	$(DOCKER_RUN_DOCS) "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "./publish.sh staging-docs v3.1"

publish-prod: docs-build
	$(DOCKER_RUN_DOCS) "$(DOCKER_DOCS_IMAGE)" /bin/bash -c "./publish.sh prod-docs root"

docs-draft: docs-build
	$(DOCKER_RUN_DOCS) -p $(if $(DOCSPORT),$(DOCSPORT):)8000 -e DOCKERHOST "$(DOCKER_DOCS_IMAGE)" hugo server --buildDrafts="true" --port=$(DOCSPORT) --baseUrl=$(HUGO_BASE_URL) --bind=$(HUGO_BIND_IP)

docs-shell: docs-build
	$(DOCKER_RUN_DOCS) -p $(if $(DOCSPORT),$(DOCSPORT):)8000 "$(DOCKER_DOCS_IMAGE)" bash

test: docs-build
	$(DOCKER_RUN_DOCS) -p $(if $(DOCSPORT),$(DOCSPORT):)8000 "$(DOCKER_DOCS_IMAGE)"

docs-build:
	docker build -t "$(DOCKER_DOCS_IMAGE)" .
