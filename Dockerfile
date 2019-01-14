# Golang build container
FROM golang:1.11.4

WORKDIR $GOPATH/src/github.com/grafana/grafana

COPY Gopkg.toml Gopkg.lock ./
COPY vendor vendor

ARG DEP_ENSURE=""
RUN if [ ! -z "${DEP_ENSURE}" ]; then \
      go get -u github.com/golang/dep/cmd/dep && \
      dep ensure --vendor-only; \
    fi

COPY pkg pkg
COPY build.go build.go
COPY package.json package.json

RUN go run build.go build

# Node build container
FROM node:8

WORKDIR /usr/src/app/

COPY package.json yarn.lock ./
RUN yarn install --pure-lockfile --no-progress

COPY Gruntfile.js tsconfig.json tslint.json ./
COPY public public
COPY scripts scripts
COPY emails emails

ENV NODE_ENV production
RUN ./node_modules/.bin/grunt build

# Final container
FROM debian:stretch-slim

ARG GF_UID="472"
ARG GF_GID="472"

ENV GF_PATHS_CONFIG_DIR="/etc/grafana"

ENV PATH=/usr/share/grafana/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    GF_PATHS_CONFIG="$GF_PATHS_CONFIG_DIR/grafana.ini" \
    GF_PATHS_DATA="/var/lib/grafana" \
    GF_PATHS_HOME="/usr/share/grafana" \
    GF_PATHS_LOGS="/var/log/grafana" \
    GF_PATHS_PLUGINS="/var/lib/grafana/plugins" \
    GF_PATHS_PROVISIONING="$GF_PATHS_CONFIG_DIR/provisioning"

WORKDIR $GF_PATHS_HOME

RUN apt-get update && apt-get upgrade -y && \
    apt-get install -qq -y libfontconfig ca-certificates && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r -g $GF_GID grafana && \
    useradd -r -u $GF_UID -g grafana grafana

COPY --chown=grafana:grafana conf ./conf

COPY --chown=grafana:grafana ./packaging/docker/run.sh /run.sh

COPY --chown=grafana:grafana --from=0 /go/src/github.com/grafana/grafana/bin/linux-amd64/grafana-server /go/src/github.com/grafana/grafana/bin/linux-amd64/grafana-cli ./bin/
COPY --chown=grafana:grafana --from=1 /usr/src/app/public ./public
COPY --chown=grafana:grafana --from=1 /usr/src/app/tools ./tools
COPY --chown=grafana:grafana tools/phantomjs/render.js ./tools/phantomjs/render.js

RUN mkdir -p "$GF_PATHS_HOME/.aws" && \
    mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
             "$GF_PATHS_PROVISIONING/dashboards" \
             "$GF_PATHS_LOGS" \
             "$GF_PATHS_PLUGINS" \
             "$GF_PATHS_DATA" && \
    cp "$GF_PATHS_HOME/conf/sample.ini" "$GF_PATHS_CONFIG" && \
    cp "$GF_PATHS_HOME/conf/ldap.toml" "$GF_PATHS_CONFIG_DIR/ldap.toml" && \
    chown -R grafana:grafana "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" && \
    chmod 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" && \
    find "$GF_PATHS_CONFIG_DIR" -type f -execdir chmod a+r {} \; && \
    find "$GF_PATHS_CONFIG_DIR" -type d -execdir chmod a+rx {} \; && \
    chmod a+rx /run.sh

EXPOSE 3000

USER grafana
ENTRYPOINT [ "/run.sh" ]
