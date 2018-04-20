# Golang build container
FROM golang:1.10

WORKDIR $GOPATH/src/github.com/grafana/grafana

COPY Gopkg.toml Gopkg.lock ./
COPY vendor vendor

ARG DEP_ENSURE=""
RUN if [ ! -z "${DEP_ENSURE}" ]; then \
      go get -u github.com/golang/dep/cmd/dep && \
      dep ensure --vendor-only; \
    fi

COPY pkg pkg
RUN go install -ldflags="-s -w" ./pkg/cmd/grafana-server && \
    go install -ldflags="-s -w" ./pkg/cmd/grafana-cli

# Node build container
FROM node:8

WORKDIR /usr/src/app/

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY Gruntfile.js tsconfig.json tslint.json ./
COPY public public
COPY scripts scripts
COPY emails emails

ENV NODE_ENV production
RUN yarn run build

# Final container
FROM debian:stretch-slim

ARG GF_UID="472"
ARG GF_GID="472"

ENV PATH=/usr/share/grafana/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    GF_PATHS_CONFIG="/etc/grafana/grafana.ini" \
    GF_PATHS_DATA="/var/lib/grafana" \
    GF_PATHS_HOME="/usr/share/grafana" \
    GF_PATHS_LOGS="/var/log/grafana" \
    GF_PATHS_PLUGINS="/var/lib/grafana/plugins" \
    GF_PATHS_PROVISIONING="/etc/grafana/provisioning"

WORKDIR $GF_PATHS_HOME

COPY conf ./conf

RUN mkdir -p "$GF_PATHS_HOME/.aws" && \
    groupadd -r -g $GF_GID grafana && \
    useradd -r -u $GF_UID -g grafana grafana && \
    mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
             "$GF_PATHS_PROVISIONING/dashboards" \
             "$GF_PATHS_LOGS" \
             "$GF_PATHS_PLUGINS" \
             "$GF_PATHS_DATA" && \
    cp "$GF_PATHS_HOME/conf/sample.ini" "$GF_PATHS_CONFIG" && \
    cp "$GF_PATHS_HOME/conf/ldap.toml" /etc/grafana/ldap.toml && \
    chown -R grafana:grafana "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" && \
    chmod 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS"

COPY --from=0 /go/bin/grafana-server /go/bin/grafana-cli ./bin/
COPY --from=1 /usr/src/app/public ./public
COPY --from=1 /usr/src/app/tools ./tools

EXPOSE 3000

COPY ./docker/run.sh /run.sh

USER grafana
ENTRYPOINT [ "/run.sh" ]
