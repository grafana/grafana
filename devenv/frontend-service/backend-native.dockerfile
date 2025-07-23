FROM ubuntu:24.04

RUN apt-get update && apt-get install -y ca-certificates tzdata

WORKDIR /grafana

RUN mkdir -p "conf/provisioning/datasources" \
"conf/provisioning/dashboards" \
"conf/provisioning/notifiers" \
"conf/provisioning/plugins" \
"conf/provisioning/access-control" \
"conf/provisioning/alerting"

COPY conf/defaults.ini conf/defaults.ini

COPY public/emails public/emails
COPY public/views public/views
COPY public/dashboards public/dashboards
COPY public/app/plugins public/app/plugins

ADD bin bin

COPY public/build/assets-manifest.json public/build/assets-manifest.json

ENTRYPOINT ["bin/grafana", "server"]