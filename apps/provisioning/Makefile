include ../sdk.mk

.PHONY: generate # Run Grafana App SDK code generation
generate: install-app-sdk update-app-sdk
	@# Filling the compiled-in manifest mounts search, trash and index fields for every listed version,
	@# so it stays as generated with Go disabled until v1beta2 is served.
	@cp ./pkg/apis/manifestdata/provisioning_manifest.go ./pkg/apis/manifestdata/provisioning_manifest.go.keep
	@$(APP_SDK_BIN) generate --source=./kinds/
	@mv ./pkg/apis/manifestdata/provisioning_manifest.go.keep ./pkg/apis/manifestdata/provisioning_manifest.go
	@# The SDK still emits resource jennies when codegen.go is disabled. v0alpha1 and v1beta1 are
	@# served from the hand-written v0alpha1 types, so only v1beta2 keeps its generated Go.
	@rm -f ./pkg/apis/provisioning/v0alpha1/constants.go ./pkg/apis/provisioning/v1beta1/constants.go
	@rm -f $(foreach v,v0alpha1 v1beta1,$(foreach f,codec object schema spec status client,./pkg/apis/provisioning/$(v)/*_$(f)_gen.go))
	@rmdir ./pkg/apis/provisioning/v1beta1 2>/dev/null || true
	@# The SDK cannot emit struct tags; strategic merge patch reads them to merge conditions by type.
	@perl -pi -e 's{(Conditions \[\]\w+Condition `json:"conditions,omitempty")`}{$$1 patchStrategy:"merge" patchMergeKey:"type"`}' \
		./pkg/apis/provisioning/v1beta2/*_status_gen.go
	@# openapi-gen only publishes enum values for types tagged +enum, which the SDK does not emit.
	@perl -0pi -e 's{\n// \+k8s:openapi-gen=true\ntype (\w+) string\n}{\n// +enum\n// +k8s:openapi-gen=true\ntype $$1 string\n}g' \
		./pkg/apis/provisioning/v1beta2/*_gen.go

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
