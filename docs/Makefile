.PHONY: docs docs-no-pull docs-test

IMAGE = grafana/grafana-docs-dev:latest

docs:
	docker pull $(IMAGE)
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it $(IMAGE)

docs-no-pull:
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it $(IMAGE)

docs-test:
	docker pull $(IMAGE)
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest --rm -it $(IMAGE) /bin/bash -c 'make prod'