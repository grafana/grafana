.DEFAULT_GOAL := all

swagger-codegen-api:
	swagger-codegen generate -v \
	-i https://grafana.github.io/alerting-api/post.json \
	-l go-server \
	-Dapis \
	-o ../ \
	--additional-properties packageName=api \
	-t ./templates \
	# --import-mappings eval.RelativeTimeRange="github.com/grafana/grafana/pkg/services/ngalert/eval" \
	# --type-mappings RelativeTimeRange=eval.RelativeTimeRange

copy-files:
	python move-and-rename.py

fix:
	sed -i -e 's/apimodels\.\[\]PostableAlert/apimodels.PostableAlerts/' ../go/*.go
	sed -i -e 's/apimodels\.\[\]UpdateDashboardAclCommand/apimodels.Permissions/' ../go/*.go
	goimports -w -v ../go/*.go

clean:
	rm -rf ../go

all: swagger-codegen-api fix copy-files clean
