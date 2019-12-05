build:
	docker build -t grafana-docs -t grafana-docs .

run:
	docker run --name grafana-docs -v $(PWD)/sources:/hugo/content -v $(PWD)/layouts:/hugo/layouts -v $(PWD)/public:/static -p 1313:1313 --rm -it grafana-docs:latest