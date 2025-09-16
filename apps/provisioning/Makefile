include ../sdk.mk

.PHONY: generate
generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate -g ./kinds --grouping=group --postprocess --defencoding=none --useoldmanifestkinds

.PHONY: build
build: generate
	go build -o bin/provisioning ./cmd/operator

# .PHONY: build/operator
# build/operator: build
#	 docker build -t provisioning:latest -f cmd/operator/Dockerfile .

.PHONY: clean
clean:
	rm -rf bin/
	rm -rf pkg/generated/

.PHONY: test
test: generate
	go test ./...

.PHONY: run
run: build
	./bin/provisioning