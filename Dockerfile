FROM registry.internal.logz.io:5000/logzio-node:16-alpine3.15 as js-builder

ENV NODE_OPTIONS=--max_old_space_size=8000

WORKDIR /grafana

COPY grafana/package.json grafana/yarn.lock grafana/.yarnrc.yml ./
COPY grafana/.yarn .yarn
COPY grafana/packages packages
COPY grafana/plugins-bundled plugins-bundled

RUN yarn install

COPY grafana/tsconfig.json grafana/.eslintrc grafana/.editorconfig grafana/.browserslistrc grafana/.prettierrc.js grafana/babel.config.json grafana/.linguirc ./
COPY grafana/public public
COPY grafana/tools tools
COPY grafana/scripts scripts
COPY grafana/emails emails

ENV NODE_ENV production
RUN yarn build

FROM registry.internal.logz.io:5000/logzio-golang:1.17.9-alpine3.15 as go-builder

RUN apk add --no-cache gcc g++ make

WORKDIR /grafana

COPY grafana/go.mod grafana/go.sum grafana/embed.go grafana/Makefile grafana/build.go grafana/package.json ./
COPY grafana/cue cue
COPY grafana/packages/grafana-schema packages/grafana-schema
COPY grafana/public/app/plugins public/app/plugins
COPY grafana/public/api-spec.json public/api-spec.json
COPY grafana/pkg pkg
COPY grafana/scripts scripts
COPY grafana/cue.mod cue.mod
COPY grafana/.bingo .bingo

RUN go mod verify
RUN make build-go

# Final stage
FROM registry.internal.logz.io:5000/logzio-alpine:3.15

LABEL maintainer="Grafana team <hello@grafana.com>"

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

RUN apk add --no-cache ca-certificates bash tzdata musl-utils
RUN apk add --no-cache openssl ncurses-libs ncurses-terminfo-base --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main
RUN apk upgrade ncurses-libs ncurses-terminfo-base --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main
RUN apk info -vv | sort

COPY grafana/conf ./conf

RUN if [ ! $(getent group "$GF_GID") ]; then \
  addgroup -S -g $GF_GID grafana; \
  fi

RUN export GF_GID_NAME=$(getent group $GF_GID | cut -d':' -f1) && \
  mkdir -p "$GF_PATHS_HOME/.aws" && \
  adduser -S -u $GF_UID -G "$GF_GID_NAME" grafana && \
  mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
  "$GF_PATHS_PROVISIONING/dashboards" \
  "$GF_PATHS_PROVISIONING/notifiers" \
  "$GF_PATHS_PROVISIONING/plugins" \
  "$GF_PATHS_PROVISIONING/access-control" \
  "$GF_PATHS_LOGS" \
  "$GF_PATHS_PLUGINS" \
  "$GF_PATHS_DATA" && \
  cp "$GF_PATHS_HOME/conf/sample.ini" "$GF_PATHS_CONFIG" && \
  cp "$GF_PATHS_HOME/conf/ldap.toml" /etc/grafana/ldap.toml && \
  chown -R "grafana:$GF_GID_NAME" "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING" && \
  chmod -R 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING"

COPY --from=go-builder /grafana/bin/*/grafana-server /grafana/bin/*/grafana-cli ./bin/
COPY --from=js-builder /grafana/public ./public
COPY --from=js-builder /grafana/tools ./tools

# LOGZ.IO GRAFANA CHANGE :: Copy custom.ini
COPY custom.ini conf/custom.ini
RUN cp "$GF_PATHS_HOME/conf/custom.ini" "$GF_PATHS_CONFIG"
# LOGZ.IO GRAFANA CHANGE :: Preinstall plugins
COPY grafana/data/plugins "$GF_PATHS_PLUGINS"
# LOGZ.IO GRAFANA CHANGE :: Remove news panel
RUN rm -rf ./public/app/plugins/panel/news
# LOGZ.IO GRAFANA CHANGE :: Remove pluginlist panel
RUN rm -rf ./public/app/plugins/panel/pluginlist

EXPOSE 3000

COPY ./grafana/packaging/docker/run.sh /run.sh

USER grafana
ENTRYPOINT [ "/run.sh" ]