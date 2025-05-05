# syntax=docker/dockerfile:1

# to maintain formatting of multiline commands in vscode, add the following to settings.json:
# "docker.languageserver.formatter.ignoreMultilineInstructions": true

ARG BASE_IMAGE=alpine:3.21
ARG JS_IMAGE=node:22-alpine
ARG JS_PLATFORM=linux/amd64
ARG GO_IMAGE=golang:1.24.2-alpine

# Default to building locally
ARG GO_SRC=go-builder
ARG JS_SRC=js-builder

# Javascript build stage
FROM --platform=${JS_PLATFORM} ${JS_IMAGE} AS js-builder

ENV NODE_OPTIONS=--max_old_space_size=8000

WORKDIR /tmp/grafana

COPY package.json project.json nx.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY packages packages
COPY public public
COPY LICENSE ./
COPY conf/defaults.ini ./conf/defaults.ini
COPY e2e e2e

RUN apk add --no-cache make build-base python3

RUN yarn install --immutable

COPY tsconfig.json eslint.config.js .editorconfig .browserslistrc .prettierrc.js ./
COPY scripts scripts
COPY emails emails

ENV NODE_ENV=production
RUN yarn build

# Golang build stage
FROM ${GO_IMAGE} AS go-builder

ARG COMMIT_SHA=""
ARG BUILD_BRANCH=""
ARG GO_BUILD_TAGS="oss"
ARG WIRE_TAGS="oss"
ARG BINGO="true"

RUN if grep -i -q alpine /etc/issue; then \
  apk add --no-cache \
  # This is required to allow building on arm64 due to https://github.com/golang/go/issues/22040
  binutils-gold \
  bash \
  # Install build dependencies
  gcc g++ make git; \
  fi

WORKDIR /tmp/grafana

COPY go.* ./
COPY .bingo .bingo
COPY .citools/bra .citools/bra
COPY .citools/cue .citools/cue
COPY .citools/cog .citools/cog
COPY .citools/lefthook .citools/lefthook
COPY .citools/jb .citools/jb
COPY .citools/golangci-lint .citools/golangci-lint
COPY .citools/swagger .citools/swagger

# Include vendored dependencies
COPY pkg/util/xorm pkg/util/xorm
COPY pkg/apis/secret pkg/apis/secret
COPY pkg/apiserver pkg/apiserver
COPY pkg/apimachinery pkg/apimachinery
COPY pkg/build pkg/build
COPY pkg/build/wire pkg/build/wire
COPY pkg/promlib pkg/promlib
COPY pkg/storage/unified/resource pkg/storage/unified/resource
COPY pkg/storage/unified/apistore pkg/storage/unified/apistore
COPY pkg/semconv pkg/semconv
COPY pkg/aggregator pkg/aggregator
COPY apps/playlist apps/playlist
COPY apps/investigations apps/investigations
COPY apps/advisor apps/advisor
COPY apps/dashboard apps/dashboard
COPY apps/folder apps/folder
COPY apps apps
COPY kindsv2 kindsv2
COPY apps/alerting/notifications apps/alerting/notifications
COPY pkg/codegen pkg/codegen
COPY pkg/plugins/codegen pkg/plugins/codegen

RUN go mod download
RUN if [[ "$BINGO" = "true" ]]; then \
  go install github.com/bwplotka/bingo@latest && \
  bingo get -v; \
  fi

COPY embed.go Makefile build.go package.json ./
COPY cue.mod cue.mod
COPY kinds kinds
COPY local local
COPY packages/grafana-schema packages/grafana-schema
COPY public/app/plugins public/app/plugins
COPY public/api-merged.json public/api-merged.json
COPY pkg pkg
COPY scripts scripts
COPY conf conf
COPY .github .github

ENV COMMIT_SHA=${COMMIT_SHA}
ENV BUILD_BRANCH=${BUILD_BRANCH}

RUN make build-go GO_BUILD_TAGS=${GO_BUILD_TAGS} WIRE_TAGS=${WIRE_TAGS}

# From-tarball build stage
FROM ${BASE_IMAGE} AS tgz-builder

WORKDIR /tmp/grafana

ARG GRAFANA_TGZ="grafana-latest.linux-x64-musl.tar.gz"

COPY ${GRAFANA_TGZ} /tmp/grafana.tar.gz

# add -v to make tar print every file it extracts
RUN tar x -z -f /tmp/grafana.tar.gz --strip-components=1

# helpers for COPY --from
FROM ${GO_SRC} AS go-src
FROM ${JS_SRC} AS js-src

# Final stage
FROM ${BASE_IMAGE}

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
RUN if grep -i -q alpine /etc/issue; then \
  apk add --no-cache ca-certificates bash curl tzdata musl-utils && \
  apk info -vv | sort; \
  elif grep -i -q ubuntu /etc/issue; then \
  DEBIAN_FRONTEND=noninteractive && \
  apt-get update && \
  apt-get install -y ca-certificates curl tzdata musl && \
  apt-get autoremove -y && \
  rm -rf /var/lib/apt/lists/*; \
  else \
  echo 'ERROR: Unsupported base image' && /bin/false; \
  fi

# glibc support for alpine x86_64 only
# docker run --rm --env STDOUT=1 sgerrand/glibc-builder 2.40 /usr/glibc-compat > glibc-bin-2.40.tar.gz
ARG GLIBC_VERSION=2.40

RUN if grep -i -q alpine /etc/issue && [ `arch` = "x86_64" ]; then \
  wget -qO- "https://dl.grafana.com/glibc/glibc-bin-$GLIBC_VERSION.tar.gz" | tar zxf - -C / \
  usr/glibc-compat/lib/ld-linux-x86-64.so.2 \
  usr/glibc-compat/lib/libc.so.6 \
  usr/glibc-compat/lib/libdl.so.2 \
  usr/glibc-compat/lib/libm.so.6 \
  usr/glibc-compat/lib/libpthread.so.0 \
  usr/glibc-compat/lib/librt.so.1 \
  usr/glibc-compat/lib/libresolv.so.2 && \
  mkdir /lib64 && \
  ln -s /usr/glibc-compat/lib/ld-linux-x86-64.so.2 /lib64; \
  fi

COPY --from=go-src /tmp/grafana/conf ./conf

RUN if [ ! $(getent group "$GF_GID") ]; then \
  if grep -i -q alpine /etc/issue; then \
  addgroup -S -g $GF_GID grafana; \
  else \
  addgroup --system --gid $GF_GID grafana; \
  fi; \
  fi && \
  GF_GID_NAME=$(getent group $GF_GID | cut -d':' -f1) && \
  mkdir -p "$GF_PATHS_HOME/.aws" && \
  if grep -i -q alpine /etc/issue; then \
  adduser -S -u $GF_UID -G "$GF_GID_NAME" grafana; \
  else \
  adduser --system --uid $GF_UID --ingroup "$GF_GID_NAME" grafana; \
  fi && \
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

COPY --from=go-src /tmp/grafana/bin/grafana* /tmp/grafana/bin/*/grafana* ./bin/
COPY --from=js-src /tmp/grafana/public ./public
COPY --from=js-src /tmp/grafana/LICENSE ./

EXPOSE 3000

ARG RUN_SH=./packaging/docker/run.sh

COPY ${RUN_SH} /run.sh

USER "$GF_UID"
ENTRYPOINT [ "/run.sh" ]
