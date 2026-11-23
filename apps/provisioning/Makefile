include ../sdk.mk

.PHONY: generate # Run Grafana App SDK code generation
generate: install-app-sdk update-app-sdk
	@$(APP_SDK_BIN) generate --source=./kinds/
	@# client-gen only generates clients for types tagged +genclient, and openapi-gen only publishes
	@# enum values for types tagged +enum; the SDK emits neither. The SDK clients and codecs are not
	@# API types, and the API builder publishes every OpenAPI definition, so keep them out of openapi-gen.
	@perl -0pi -e 's{\n// \+k8s:openapi-gen=true\ntype (Repository|Connection|Job|HistoricJob) struct}{\n// +genclient\n// +k8s:openapi-gen=true\ntype $$1 struct}g' \
		./pkg/apis/provisioning/v0alpha1/*_object_gen.go
	@perl -0pi -e 's{\n// \+k8s:openapi-gen=true\ntype (\w+) string\n}{\n// +enum\n// +k8s:openapi-gen=true\ntype $$1 string\n}g' \
		./pkg/apis/provisioning/v0alpha1/*_gen.go
	@perl -0pi -e 's{\ntype (\w+(?:Client|JSONCodec)) struct}{\n// +k8s:openapi-gen=false\ntype $$1 struct}g' \
		./pkg/apis/provisioning/v0alpha1/*_client_gen.go ./pkg/apis/provisioning/v0alpha1/*_codec_gen.go
	@# The SDK cannot emit struct tags; strategic merge patch reads them to merge conditions by type.
	@perl -pi -e 's{(Conditions \[\]\w+Condition `json:"conditions,omitempty")`}{$$1 patchStrategy:"merge" patchMergeKey:"type"`}' \
		./pkg/apis/provisioning/v0alpha1/*_status_gen.go
	@# Keep the optionality of the hand-written kinds: metadata, spec and status stay optional in the
	@# OpenAPI document, and an empty HistoricJobList omits items instead of encoding null.
	@perl -pi -e 's{(\t(?:metav1\.(?:ObjectMeta|ListMeta)|Spec \w+|Status \w+) `json:"(?:metadata|spec|status))"}{$$1,omitempty"}' \
		./pkg/apis/provisioning/v0alpha1/*_object_gen.go
	@perl -pi -e 's{(Items +\[\]HistoricJob `json:"items)"}{$$1,omitempty"}' ./pkg/apis/provisioning/v0alpha1/historicjob_object_gen.go
	@# A test job's duration is a metav1.Duration, which always encodes, so an unset one stays "0s".
	@perl -0pi -e 's{(\npackage v0alpha1\n)(.*?\tDuration )\*string( `json:"duration,omitempty"`)}{$$1\nimport metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"\n$$2metav1.Duration$$3}s' \
		./pkg/apis/provisioning/v0alpha1/job_spec_gen.go ./pkg/apis/provisioning/v0alpha1/historicjob_spec_gen.go
	@# v1beta1 is served from the v0alpha1 types (see pkg/apis/provisioning/v1beta1/types.go); keep only its schemas.
	@rm -f ./pkg/apis/provisioning/v1beta1/*_codec_gen.go ./pkg/apis/provisioning/v1beta1/*_object_gen.go \
		./pkg/apis/provisioning/v1beta1/*_spec_gen.go ./pkg/apis/provisioning/v1beta1/*_status_gen.go

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
