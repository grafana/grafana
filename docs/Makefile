.PHONY: docs docs-no-pull docs-test docs-local-static

IMAGE = grafana/grafana-docs-dev:latest
CONTENT_PATH = /hugo/content/docs/grafana/latest
LOCAL_STATIC_PATH = ../../website/static
PORT = 3002:3002 

docs:
	docker pull $(IMAGE)
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH) -p $(PORT) --rm -it $(IMAGE)

docs-no-pull:
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH) -p $(PORT) --rm -it $(IMAGE)

docs-test:
	docker pull $(IMAGE)
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH) --rm -it $(IMAGE) /bin/bash -c 'make prod'

# expects that you have grafana/website checked out in same path as the grafana repo.
docs-local-static:
	docker pull $(IMAGE)
	if [ ! -d "$(LOCAL_STATIC_PATH)" ]; then echo "local path (website project) $(LOCAL_STATIC_PATH) not found"]; exit 1; fi
	docker run -v $(shell pwd)/sources:$(CONTENT_PATH) \
		-v $(shell pwd)/$(LOCAL_STATIC_PATH):/hugo/static -p $(PORT) --rm -it $(IMAGE)