.PHONY: pull docs docs-quick docs-no-pull docs-test docs-local-static

PODMAN = $(shell if command -v podman >/dev/null 2>&1; then echo podman; else echo docker; fi)
IMAGE = grafana/docs-base:latest
CONTENT_PATH = /hugo/content/docs/grafana/latest
LOCAL_STATIC_PATH = ../../website/static
PORT = 3002:3002

pull:
	$(PODMAN) pull $(IMAGE)

docs: pull
	$(PODMAN) run --init -v $(shell pwd)/sources:$(CONTENT_PATH):Z -p $(PORT) --rm -it $(IMAGE) make server

docs-preview: pull
	$(PODMAN) run --init -v $(shell pwd)/sources:$(CONTENT_PATH):Z -p $(PORT) --rm -it $(IMAGE) make server BUILD_DRAFTS=true

docs-no-pull:
	$(PODMAN) run --init -v $(shell pwd)/sources:$(CONTENT_PATH):Z -p $(PORT) --rm -it $(IMAGE) make server

docs-test: pull
	$(PODMAN) run --init -v $(shell pwd)/sources:$(CONTENT_PATH):Z --rm -it $(IMAGE) make prod

# expects that you have grafana/website checked out in same path as the grafana repo.
docs-local-static: pull
	if [ ! -d "$(LOCAL_STATIC_PATH)" ]; then echo "local path (website project) $(LOCAL_STATIC_PATH) not found"]; exit 1; fi
	$(PODMAN) run --init -v $(shell pwd)/sources:$(CONTENT_PATH):Z \
		-v $(shell pwd)/$(LOCAL_STATIC_PATH):/hugo/static:Z -p $(PORT) --rm -it $(IMAGE)
