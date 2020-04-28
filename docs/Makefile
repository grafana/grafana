.PHONY: docs docs-test

IMAGE = grafana/docs-base:latest 

docs:
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it $(IMAGE) /bin/bash -c 'make server'

docs-test:
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest --rm -it $(IMAGE) /bin/bash -c 'make prod'
