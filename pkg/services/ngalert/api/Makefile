.DEFAULT_GOAL := all

GENERATED_GO_MATCHERS = ./go/*.go

swagger-codegen-api:
	docker run --rm -v $$(pwd):/local --user $$(id -u):$$(id -g) swaggerapi/swagger-codegen-cli generate \
	-i /local/tooling/post.json \
	-l go-server \
	-Dapis \
	-o /local \
	--additional-properties packageName=api \
	-t /local/tooling/swagger-codegen/templates \
	# --import-mappings eval.RelativeTimeRange="github.com/grafana/grafana/pkg/services/ngalert/eval" \
	# --type-mappings RelativeTimeRange=eval.RelativeTimeRange

copy-files:
	ls -1 go | xargs -n 1 -I {} mv go/{} generated_base_{}

fix:
	sed -i -e 's/apimodels\.\[\]PostableAlert/apimodels.PostableAlerts/' $(GENERATED_GO_MATCHERS)
	sed -i -e 's/apimodels\.\[\]UpdateDashboardAclCommand/apimodels.Permissions/' $(GENERATED_GO_MATCHERS)
	goimports -w -v $(GENERATED_GO_MATCHERS)

clean:
	rm -rf ./go

all: swagger-codegen-api fix copy-files clean
