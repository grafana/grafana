# syntax=docker/dockerfile:1
ARG GF_VERSION

ARG BASE_IMAGE=alpine:3.18.3
ARG JS_IMAGE=node:18-alpine3.18
ARG BUILDPLATFORM=linux/amd64
ARG GO_IMAGE=golang:1.20.8

ARG GO_SRC=go-builder
ARG JS_SRC=js-builder

FROM --platform=${BUILDPLATFORM} ${JS_IMAGE} as js-builder

ENV NODE_OPTIONS=--max_old_space_size=8000

WORKDIR /tmp/grafana

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn
COPY packages packages
COPY plugins-bundled plugins-bundled

RUN yarn install --immutable

COPY tsconfig.json .eslintrc .editorconfig .browserslistrc .prettierrc.js babel.config.json .linguirc ./
COPY public public
COPY scripts scripts
COPY emails emails

ENV NODE_ENV production
RUN yarn build

FROM --platform=${BUILDPLATFORM} ${GO_IMAGE} as go-builder

ARG COMMIT_SHA=""
ARG BUILD_BRANCH=""
ARG GO_BUILD_TAGS="oss"
ARG WIRE_TAGS="oss"
ARG BINGO="true"

# Install build dependencies
RUN if grep -i -q alpine /etc/issue; then \
      apk add --no-cache gcc g++ make git; \
    fi

WORKDIR /tmp/grafana

COPY go.* ./
COPY .bingo .bingo

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
COPY LICENSE ./

ENV COMMIT_SHA=${COMMIT_SHA}
ENV BUILD_BRANCH=${BUILD_BRANCH}

RUN make gen-go WIRE_TAGS=${WIRE_TAGS}

FROM ${GO_SRC} as go-build-amd64
RUN make build-go GO_BUILD_TAGS=${GO_BUILD_TAGS} WIRE_TAGS=${WIRE_TAGS}

FROM ${GO_SRC} as go-build-arm64

RUN apt-get update && \
    apt-get -y install gcc-aarch64-linux-gnu;

ENV GOARCH=arm64
ENV CC=aarch64-linux-gnu-gcc
RUN make build-go GO_BUILD_TAGS=${GO_BUILD_TAGS} WIRE_TAGS=${WIRE_TAGS}

FROM ${BASE_IMAGE} as tgz-builder

WORKDIR /tmp/grafana

# ARG GRAFANA_TGZ="grafana-latest.linux-x64-musl.tar.gz"

# COPY ${GRAFANA_TGZ} /tmp/grafana.tar.gz

# # add -v to make tar print every file it extracts
# RUN tar x -z -f /tmp/grafana.tar.gz --strip-components=1

COPY ./public ./public
COPY ./scripts ./scripts
COPY ./plugins-bundled ./plugins-bundled

# helpers for COPY --from
ARG TARGETARCH
FROM go-build-${TARGETARCH} as go-src
FROM ${JS_SRC} as js-src

# Final stage
FROM ${BASE_IMAGE}

LABEL maintainer="Grafana Labs <hello@grafana.com>"

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
RUN if grep -i -q alpine /etc/issue && [ `arch` = "x86_64" ]; then \
      wget -q -O /etc/apk/keys/sgerrand.rsa.pub https://alpine-pkgs.sgerrand.com/sgerrand.rsa.pub && \
      wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.35-r0/glibc-2.35-r0.apk \
        -O /tmp/glibc-2.35-r0.apk && \
      wget https://github.com/sgerrand/alpine-pkg-glibc/releases/download/2.35-r0/glibc-bin-2.35-r0.apk \
        -O /tmp/glibc-bin-2.35-r0.apk && \
      apk add --force-overwrite --no-cache /tmp/glibc-2.35-r0.apk /tmp/glibc-bin-2.35-r0.apk && \
      rm -f /lib64/ld-linux-x86-64.so.2 && \
      ln -s /usr/glibc-compat/lib64/ld-linux-x86-64.so.2 /lib64/ld-linux-x86-64.so.2 && \
      rm -f /tmp/glibc-2.35-r0.apk && \
      rm -f /tmp/glibc-bin-2.35-r0.apk && \
      rm -f /lib/ld-linux-x86-64.so.2 && \
      rm -f /etc/ld.so.cache; \
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
COPY --from=go-src /tmp/grafana/LICENSE ./

EXPOSE 3000

ARG RUN_SH=./packaging/docker/run.sh

COPY ${RUN_SH} /run.sh

USER "$GF_UID"
ENTRYPOINT [ "/run.sh" ]

FROM grafana/grafana:${GF_VERSION}-ubuntu as groundcover

COPY --from=go-src /tmp/grafana/bin/grafana* /tmp/grafana/bin/*/grafana* ./bin/
COPY --from=js-src /tmp/grafana/public ./public

USER 0

ENV GF_PLUGIN_DIR="/usr/share/grafana/plugins" \
    GF_PATHS_PLUGINS="/usr/share/grafana/plugins"

ENV GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=grafana-clickhouse-datasource
RUN mkdir -p ${GF_PLUGIN_DIR} && \
    chmod -R 777 ${GF_PLUGIN_DIR} && \
    grafana cli plugins install grafana-clickhouse-datasource 4.0.3 && \
    grafana cli plugins install marcusolsson-treemap-panel 2.0.1

USER "$GF_UID"
