.PHONY: docs docs-no-pull docs-test

docs:
	docker pull grafana/docs-base:latest
	docker run -v $(PWD)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it grafana/docs-base:latest /bin/bash -c 'npm i && make webpack && make docs-menu && hugo server -p 3002 -D --ignoreCache --baseUrl http://localhost:3002 --bind 0.0.0.0'

docs-no-pull:
	docker run -v $(PWD)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it grafana/docs-base:latest /bin/bash -c 'make docs-menu && hugo server -p 3002 -D --ignoreCache --baseUrl http://localhost:3002 --bind 0.0.0.0'

docs-test:
	docker pull grafana/docs-base:latest
	docker run -v $(PWD)/sources:/hugo/content/docs/grafana/latest --rm -it grafana/docs-base:latest /bin/bash -c 'npm i && make prod'
