# syntax=docker/dockerfile:1.7-labs
# to maintain formatting of multiline commands in vscode, add the following to settings.json:
# "docker.languageserver.formatter.ignoreMultilineInstructions": true

ARG GO_IMAGE=go-builder-base
ARG JS_IMAGE=js-builder-base
ARG JS_PLATFORM=$BUILDPLATFORM

# Dependabot cannot update dependencies listed in ARGs
# By using FROM instructions we can delegate dependency updates to dependabot
FROM alpine:3.23.3 AS alpine-base
FROM ubuntu:22.04 AS ubuntu-base
FROM --platform=$BUILDPLATFORM golang:1.25.8-alpine AS go-builder-base
FROM --platform=${JS_PLATFORM} node:24-alpine AS js-builder-base
# Javascript build stage
FROM --platform=${JS_PLATFORM} ${JS_IMAGE} AS js-builder
ARG JS_NODE_ENV=production
ARG JS_YARN_INSTALL_FLAG=--immutable
ARG JS_YARN_BUILD_FLAG=build

ENV NODE_OPTIONS=--max_old_space_size=8000
ENV NODE_ENV=${JS_NODE_ENV}

WORKDIR /tmp/grafana

RUN apk add --no-cache make build-base python3

COPY package.json project.json nx.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn

COPY --parents **/package.json ./

RUN yarn install ${JS_YARN_INSTALL_FLAG}

COPY packages packages
COPY e2e-playwright e2e-playwright
COPY public public
COPY LICENSE ./
COPY conf/defaults.ini ./conf/defaults.ini
COPY e2e e2e

COPY tsconfig.json eslint.config.js .editorconfig .browserslistrc .prettierrc.js ./
COPY scripts scripts
COPY emails emails

RUN yarn ${JS_YARN_BUILD_FLAG}

# Golang build stage — runs on the host, cross-compiles via GOOS/GOARCH
FROM --platform=$BUILDPLATFORM ${GO_IMAGE} AS go-builder

ARG COMMIT_SHA=""
ARG BUILD_BRANCH=""
ARG GO_BUILD_TAGS="oss"
ARG WIRE_TAGS="oss"

RUN apk add --no-cache \
  bash \
  make git

WORKDIR /tmp/grafana

COPY go.work go.work.sum go.mod go.sum ./
COPY --parents **/go.mod **/go.sum ./

RUN go mod download

COPY .citools .citools

# Copy go dependencies first
# If updating this, please also update devenv/frontend-service/backend.dockerfile
COPY pkg pkg
COPY apps apps
COPY kinds kinds
COPY kindsv2 kindsv2

# Root files
COPY embed.go Makefile package.json ./
COPY cue.mod cue.mod
COPY local local
COPY packages/grafana-schema packages/grafana-schema
COPY packages/grafana-data/src/themes/themeDefinitions packages/grafana-data/src/themes/themeDefinitions
COPY public/app/plugins public/app/plugins
COPY public/api-merged.json public/api-merged.json
COPY scripts scripts
COPY conf conf
COPY .github .github

ENV COMMIT_SHA=${COMMIT_SHA}
ENV BUILD_BRANCH=${BUILD_BRANCH}
ENV CGO_ENABLED=0

ARG TARGETOS
ARG TARGETARCH
RUN --mount=type=cache,target=/root/.cache/go-build \
    make build-go GO_BUILD_TAGS=${GO_BUILD_TAGS} WIRE_TAGS=${WIRE_TAGS} GO_BUILD_OS=${TARGETOS} GO_BUILD_ARCH=${TARGETARCH}

RUN mkdir -p data/plugins-bundled

# Alpine base image
FROM alpine-base AS alpine-final

LABEL maintainer="Grafana Labs <hello@grafana.com>"
LABEL org.opencontainers.image.source="https://github.com/grafana/grafana"

ARG GF_UID="472"
ARG GF_GID="0"

ENV PATH="/usr/share/grafana/bin:$PATH" \
  GF_PATHS_CONFIG="/etc/grafana/grafana.ini" \
  GF_PATHS_DATA="/var/lib/grafana" \
  GF_PATHS_HOME="/usr/share/grafana" \
  GF_PATHS_LOGS="/var/log/grafana" \
  GF_PATHS_PLUGINS="/var/lib/grafana/plugins" \
  GF_PATHS_PROVISIONING="/etc/grafana/provisioning"

WORKDIR $GF_PATHS_HOME

# Install dependencies
RUN apk add --no-cache ca-certificates bash bubblewrap curl tzdata musl-utils

COPY --from=go-builder /tmp/grafana/conf ./conf

RUN if [ ! $(getent group "$GF_GID") ]; then \
  addgroup -S -g $GF_GID grafana; \
  fi

RUN GF_GID_NAME=$(getent group $GF_GID | cut -d':' -f1) && \
  mkdir -p "$GF_PATHS_HOME/.aws" && \
  adduser -S -u $GF_UID -G "$GF_GID_NAME" grafana; \
  mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
  "$GF_PATHS_PROVISIONING/dashboards" \
  "$GF_PATHS_PROVISIONING/notifiers" \
  "$GF_PATHS_PROVISIONING/plugins" \
  "$GF_PATHS_PROVISIONING/access-control" \
  "$GF_PATHS_PROVISIONING/alerting" \
  "$GF_PATHS_LOGS" \
  "$GF_PATHS_PLUGINS" \
  "$GF_PATHS_DATA" && \
  cp conf/sample.ini "$GF_PATHS_CONFIG" && \
  cp conf/ldap.toml /etc/grafana/ldap.toml && \
  chown -R "grafana:$GF_GID_NAME" "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING" && \
  chmod -R 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING"

COPY --from=go-builder /tmp/grafana/bin/grafana* /tmp/grafana/bin/*/grafana* ./bin/
COPY --from=js-builder /tmp/grafana/public ./public
COPY --from=js-builder /tmp/grafana/LICENSE ./
COPY --from=go-builder /tmp/grafana/data/plugins-bundled ./data/plugins-bundled

RUN grafana server -v | sed -e 's/Version //' > /.grafana-version && \
  chmod 644 /.grafana-version

EXPOSE 3000

COPY ./packaging/docker/run.sh /run.sh

USER "$GF_UID"
ENTRYPOINT [ "/run.sh" ]

FROM ubuntu-base AS ubuntu-final

LABEL maintainer="Grafana Labs <hello@grafana.com>"
LABEL org.opencontainers.image.source="https://github.com/grafana/grafana"

ARG GF_UID="472"
ARG GF_GID="0"

ENV PATH="/usr/share/grafana/bin:$PATH" \
  GF_PATHS_CONFIG="/etc/grafana/grafana.ini" \
  GF_PATHS_DATA="/var/lib/grafana" \
  GF_PATHS_HOME="/usr/share/grafana" \
  GF_PATHS_LOGS="/var/log/grafana" \
  GF_PATHS_PLUGINS="/var/lib/grafana/plugins" \
  GF_PATHS_PROVISIONING="/etc/grafana/provisioning"

WORKDIR $GF_PATHS_HOME

# Install dependencies
RUN apt-get update && \
  apt-get install -y ca-certificates curl tzdata && \
  apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*

COPY --from=go-builder /tmp/grafana/conf ./conf

RUN if ! getent group "$GF_GID" > /dev/null; then \
  addgroup --system --gid $GF_GID grafana; \
  fi

RUN GF_GID_NAME=$(getent group $GF_GID | cut -d':' -f1) && \
  mkdir -p "$GF_PATHS_HOME/.aws" && \
  adduser --system --uid $GF_UID --ingroup "$GF_GID_NAME" grafana && \
  mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
  "$GF_PATHS_PROVISIONING/dashboards" \
  "$GF_PATHS_PROVISIONING/notifiers" \
  "$GF_PATHS_PROVISIONING/plugins" \
  "$GF_PATHS_PROVISIONING/access-control" \
  "$GF_PATHS_PROVISIONING/alerting" \
  "$GF_PATHS_LOGS" \
  "$GF_PATHS_PLUGINS" \
  "$GF_PATHS_DATA" && \
  cp conf/sample.ini "$GF_PATHS_CONFIG" && \
  cp conf/ldap.toml /etc/grafana/ldap.toml && \
  chown -R "grafana:$GF_GID_NAME" "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING" && \
  chmod -R 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING"

COPY --from=go-builder /tmp/grafana/bin/grafana* /tmp/grafana/bin/*/grafana* ./bin/
COPY --from=js-builder /tmp/grafana/public ./public
COPY --from=js-builder /tmp/grafana/LICENSE ./
COPY --from=go-builder /tmp/grafana/data/plugins-bundled ./data/plugins-bundled

RUN grafana server -v | sed -e 's/Version //' > /.grafana-version && \
  chmod 644 /.grafana-version

EXPOSE 3000

COPY ./packaging/docker/run.sh /run.sh

USER "$GF_UID"
ENTRYPOINT [ "/run.sh" ]