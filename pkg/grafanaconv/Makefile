WEAVER_IMAGE := otel/weaver

.PHONY: all
all: go docs

.PHONY: docs
docs:
	@docker run --rm -u 1000:1000 \
		--env HOME=/tmp/weaver \
		--mount 'type=bind,source=$(PWD)/model,target=/source/model,readonly' \
		--mount 'type=bind,source=$(PWD)/docs,target=/home/weaver/output' \
		$(WEAVER_IMAGE) registry generate \
		--registry=/source/model \
		--templates="https://github.com/open-telemetry/semantic-conventions/archive/refs/tags/v1.37.0.zip[templates]" \
		markdown \
		/home/weaver/output

.PHONY: update-docs
update-docs:
	@docker run --rm -u 1000:1000 \
		--env HOME=/tmp/weaver \
		--mount 'type=bind,source=$(PWD)/model,target=/source/model,readonly' \
		--mount 'type=bind,source=$(PWD)/docs,target=/home/weaver/output' \
		$(WEAVER_IMAGE) registry update-markdown \
		--registry=/source/model \
		--templates="https://github.com/open-telemetry/semantic-conventions/archive/refs/tags/v1.37.0.zip[templates]" \
		--target=markdown \
		/home/weaver/output

.PHONY: go
go:
	@docker run --rm -u 1000:1000 \
		--env HOME=/tmp/weaver \
		--mount 'type=bind,source=$(PWD)/model,target=/source/model,readonly' \
		--mount 'type=bind,source=$(PWD)/templates/go,target=/home/weaver/templates/registry/go,readonly' \
		--mount 'type=bind,source=$(PWD),target=/home/weaver/output' \
		$(WEAVER_IMAGE) registry generate \
		--registry=/source/model \
		--templates=/home/weaver/templates \
		go
	@go fmt

