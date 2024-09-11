.PHONY: all
all: go markdown

.PHONY: go
go: 
	@docker run --rm -u 1000:1000 -v./model:/tmp/grafana/model -v./:/tmp/grafana/output -v./templates:/tmp/grafana/templates \
		otel/semconvgen --yaml-root "/tmp/grafana/model/" \
		code --template "/tmp/grafana/templates/template.j2" \
  		--output "/tmp/grafana/output/attributes.go"
	@go fmt

.PHONY: markdown
markdown:
	@docker run --rm -u 1000:1000 -v./model:/tmp/grafana/model -v./:/tmp/grafana/output -v./templates:/tmp/grafana/templates \
		otel/semconvgen --yaml-root "/tmp/grafana/model/" \
		markdown --markdown-root "/tmp/grafana/output/"
	@npx --yes -- markdown-toc --bullets "-" --no-first-h1 --no-stripHeadingTags -i README.md || exit 1

