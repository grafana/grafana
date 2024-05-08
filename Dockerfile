# syntax=docker/dockerfile:1

ARG BASE_IMAGE=406095609952.dkr.ecr.us-east-1.amazonaws.com/alpine:3.12.1
ARG JS_IMAGE=406095609952.dkr.ecr.us-east-1.amazonaws.com/node:20.8.1-alpine
ARG JS_PLATFORM=linux/amd64
ARG GO_IMAGE=406095609952.dkr.ecr.us-east-1.amazonaws.com/golang:1.21.8-alpine

ARG GO_SRC=go-builder
ARG JS_SRC=js-builder

FROM ${JS_IMAGE} as js-builder

ENV NODE_OPTIONS=--max_old_space_size=8000

WORKDIR /tmp/grafana

COPY grafana/package.json grafana/yarn.lock grafana/.yarnrc.yml ./
COPY grafana/.yarn .yarn
COPY grafana/packages packages
COPY grafana/plugins-bundled plugins-bundled
COPY grafana/public public

RUN apk add --no-cache make build-base python3

RUN yarn install --immutable

COPY grafana/tsconfig.json grafana/.eslintrc grafana/.editorconfig grafana/.browserslistrc grafana/.prettierrc.js ./
COPY grafana/public public
COPY grafana/scripts scripts
COPY grafana/emails emails

ENV NODE_ENV production
RUN yarn build

FROM ${GO_IMAGE} as go-builder

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

COPY grafana/go.* ./
COPY grafana/.bingo .bingo

# Include vendored dependencies
COPY grafana/pkg/util/xorm/go.* pkg/util/xorm/

RUN go mod download
RUN if [[ "$BINGO" = "true" ]]; then \
      go install github.com/bwplotka/bingo@latest && \
      bingo get -v; \
    fi

COPY grafana/embed.go grafana/Makefile grafana/build.go grafana/package.json ./
COPY grafana/cue.mod cue.mod
COPY grafana/kinds kinds
COPY grafana/local local
COPY grafana/packages/grafana-schema packages/grafana-schema
COPY grafana/public/app/plugins public/app/plugins
COPY grafana/public/api-merged.json public/api-merged.json
COPY grafana/pkg pkg
COPY grafana/scripts scripts
COPY grafana/conf conf
COPY grafana/.github .github
COPY grafana/LICENSE ./

ENV COMMIT_SHA=${COMMIT_SHA}
ENV BUILD_BRANCH=${BUILD_BRANCH}

RUN make build-go GO_BUILD_TAGS=${GO_BUILD_TAGS} WIRE_TAGS=${WIRE_TAGS}

FROM ${BASE_IMAGE} as tgz-builder

WORKDIR /tmp/grafana

ARG GRAFANA_TGZ="grafana-latest.linux-x64-musl.tar.gz"

COPY ${GRAFANA_TGZ} /tmp/grafana.tar.gz

# add -v to make tar print every file it extracts
RUN tar x -z -f /tmp/grafana.tar.gz --strip-components=1

# helpers for COPY --from
FROM ${GO_SRC} as go-src
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

# LOGZ.IO GRAFANA CHANGE :: Copy custom.ini
COPY custom.ini conf/custom.ini
RUN cp "$GF_PATHS_HOME/conf/custom.ini" "$GF_PATHS_CONFIG"
# LOGZ.IO GRAFANA CHANGE :: Preinstall plugins
# COPY grafana/data/plugins "$GF_PATHS_PLUGINS"
# LOGZ.IO GRAFANA CHANGE :: Remove news panel
RUN rm -rf ./public/app/plugins/panel/news
# LOGZ.IO GRAFANA CHANGE :: Remove pluginlist panel - but it does not exist in v10
# RUN rm -rf ./public/app/plugins/panel/pluginlist
EXPOSE 3333

ARG RUN_SH=grafana/packaging/docker/run.sh

COPY ${RUN_SH} /run.sh

USER "$GF_UID"
ENTRYPOINT [ "/run.sh" ]