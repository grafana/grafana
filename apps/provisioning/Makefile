include ../sdk.mk

.PHONY: generate
generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate -g ./kinds --grouping=group --postprocess --defencoding=none --useoldmanifestkinds

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