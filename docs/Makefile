menu:
	cp ./sources/menu.yaml ./data/menu.yaml

build:
	docker build -t grafana-docs -t grafana-docs .

run: menu
	docker run --name grafana-docs -v $(PWD)/sources:/hugo/content -v $(PWD)/layouts:/hugo/layouts -v $(PWD)/data:/hugo/data -p 1313:1313 --rm -it grafana-docs:latest