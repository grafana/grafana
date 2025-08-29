FROM ubuntu:24.04

RUN --mount=type=cache,target=/var/lib/apt/lists \
    --mount=type=cache,target=/var/cache/apt \
    set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates; \
    update-ca-certificates

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
COPY public/gazetteer public/gazetteer
COPY public/maps public/maps

ADD devenv/frontend-service/build/grafana bin/grafana

COPY public/build/assets-manifest.json public/build/assets-manifest.json

ENTRYPOINT ["bin/grafana", "server"]
