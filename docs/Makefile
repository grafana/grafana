.PHONY: all binary build cross default docs docs-build docs-shell shell test test-unit test-integration test-integration-cli test-docker-py validate

# env vars passed through directly to Docker's build scripts
# to allow things like `make DOCKER_CLIENTONLY=1 binary` easily
# `docs/sources/contributing/devenvironment.md ` and `project/PACKAGERS.md` have some limited documentation of some of these
DOCKER_ENVS := \
	-e BUILDFLAGS \
	-e DOCKER_CLIENTONLY \
	-e DOCKER_EXECDRIVER \
	-e DOCKER_GRAPHDRIVER \
	-e TESTDIRS \
	-e TESTFLAGS \
	-e TIMEOUT
# note: we _cannot_ add "-e DOCKER_BUILDTAGS" here because even if it's unset in the shell, that would shadow the "ENV DOCKER_BUILDTAGS" set in our Dockerfile, which is very important for our official builds

# to allow `make DOCSDIR=docs docs-shell` (to create a bind mount in docs)
DOCS_MOUNT := $(if $(DOCSDIR),-v $(CURDIR)/$(DOCSDIR):/$(DOCSDIR))

# to allow `make DOCSPORT=9000 docs`
DOCSPORT := 8180

GIT_BRANCH := $(shell git rev-parse --abbrev-ref HEAD 2>/dev/null)
DOCKER_DOCS_IMAGE := grafana-docs-base$(if $(GIT_BRANCH),:$(GIT_BRANCH))

DOCKER_RUN_DOCS := docker run --rm -it $(DOCS_MOUNT) -e AWS_S3_BUCKET -e NOCACHE

# for some docs workarounds (see below in "docs-build" target)
GITCOMMIT := $(shell git rev-parse --short HEAD 2>/dev/null)

default: docs

docs: docs-build
	$(DOCKER_RUN_DOCS) -p $(if $(DOCSPORT),$(DOCSPORT):)8000 "$(DOCKER_DOCS_IMAGE)" mkdocs serve

docs-shell: docs-build
	$(DOCKER_RUN_DOCS) -p $(if $(DOCSPORT),$(DOCSPORT):)8000 "$(DOCKER_DOCS_IMAGE)" bash

docs-release: docs-build
	$(DOCKER_RUN_DOCS) -e OPTIONS -e BUILD_ROOT -e DISTRIBUTION_ID \
		-v $(CURDIR)/awsconfig:/docs/awsconfig \
		"$(DOCKER_DOCS_IMAGE)" ./release.sh

docs-test: docs-build
	$(DOCKER_RUN_DOCS) "$(DOCKER_DOCS_IMAGE)" ./test.sh

docs-build:
<<<<<<< a84f1f0a3df6380f5a6561dd65aca819f7df5e8a
	git fetch https://github.com/grafana/grafana.git docs-2.1 && git diff --name-status FETCH_HEAD...HEAD -- . > changed-files
=======
	git fetch https://github.com/Cepave/grafana.git docs-1.x && git diff --name-status FETCH_HEAD...HEAD -- . > changed-files
>>>>>>> Replace the import path with github.com/Cepave/grafana.
	echo "$(GIT_BRANCH)" > GIT_BRANCH
	echo "$(GITCOMMIT)" > GITCOMMIT
	docker build -t "$(DOCKER_DOCS_IMAGE)" .
