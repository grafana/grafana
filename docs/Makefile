.PHONY: docs

docs:
	docker pull grafana/docs-base:latest
	docker run -v $(PWD)/sources:/hugo/content/docs/grafana/latest -p 3002:3002 --rm -it grafana/docs-base:latest
