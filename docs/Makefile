.PHONY: docs docs-test

IMAGE = grafana/docs-base@sha256:63758b74e3990ab61e274f5e98da092d5c38378829dad0488aa97c59f0144f34

docs:
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it $(IMAGE) /bin/bash -c 'make server'

docs-test:
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest --rm -it $(IMAGE) /bin/bash -c 'make prod'
