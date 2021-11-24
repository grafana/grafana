.PHONY: pull docs docs-quick docs-no-pull docs-test docs-local-static

IMAGE = grafana/docs-base:latest
CONTENT_PATH = /hugo/content/docs/grafana/next
LOCAL_STATIC_PATH = ../../website/static
PORT = 3002:3002

pull:
	docker pull $(IMAGE)

run:
	docker run -it -v $(shell pwd)/sources:$(CONTENT_PATH):Z -p $(PORT) --rm -it $(IMAGE) bash -c "make docs-preview"

docs: pull run

docs-no-pull: run

docs-test: pull
	docker run -it -v $(shell pwd)/sources:$(CONTENT_PATH):Z -p $(PORT) --rm -it $(IMAGE) bash -c "make docs-test"

# expects that you have grafana/website checked out in same path as the grafana repo.
docs-local-static: pull
	if [ ! -d "$(LOCAL_STATIC_PATH)" ]; then echo "local path (website project) $(LOCAL_STATIC_PATH) not found"]; exit 1; fi
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH):Z \
		-v $(shell pwd)/$(LOCAL_STATIC_PATH):/hugo/static:Z -p $(PORT) --rm -it $(IMAGE)