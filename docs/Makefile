.PHONY: docs docs-test docs-no-pull docs-generate-frontend docs-no-generate-frontend

IMAGE = grafana/docs-base:latest

docs-generate-frontend:
	yarn install --pure-lockfile
	yarn run packages:build
	yarn run packages:docsExtract
	yarn run packages:docsToMarkdown
	yarn run packages:clean

docs-no-generate-frontend:
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it $(IMAGE) /bin/bash -c 'hugo server -p 3002'

docs: docs-generate-frontend
	docker pull $(IMAGE)
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it $(IMAGE) /bin/bash -c 'make server'

docs-no-pull: docs-generate-frontend docs-no-generate-frontend

docs-test: docs-generate-frontend
	docker pull $(IMAGE)
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest --rm -it $(IMAGE) /bin/bash -c 'make prod'

docs-file-based:
	docker run -v $(shell pwd)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it grafana/docs-base:file-based-menu /bin/bash -c 'hugo server -p 3002 --bind 0.0.0.0'
