.PHONY: pull docs docs-quick docs-no-pull docs-test docs-local-static

IMAGE = grafana/grafana-docs-dev:latest
CONTENT_PATH = /hugo/content/docs/grafana/next
LOCAL_STATIC_PATH = ../../website/static
PORT = 3002:3002

pull:
	docker pull $(IMAGE)

docs: pull
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH):Z -p $(PORT) --rm -it $(IMAGE) /bin/bash -c "make server"

docs-quick: pull
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH):Z -p $(PORT) --rm -it $(IMAGE) /bin/bash -c "make server-quick"

docs-no-pull:
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH):Z -p $(PORT) --rm -it $(IMAGE) /bin/bash -c "make server"

docs-test: pull
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH):Z --rm -it $(IMAGE) /bin/bash -c 'make prod'

# expects that you have grafana/website checked out in same path as the grafana repo.
docs-local-static: pull
	if [ ! -d "$(LOCAL_STATIC_PATH)" ]; then echo "local path (website project) $(LOCAL_STATIC_PATH) not found"]; exit 1; fi
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH):Z \
		-v $(shell pwd)/$(LOCAL_STATIC_PATH):/hugo/static:Z -p $(PORT) --rm -it $(IMAGE)
