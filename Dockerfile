# Golang build container
FROM golang:1.13.4-alpine

RUN apk add --no-cache gcc g++

WORKDIR $GOPATH/src/github.com/grafana/grafana

COPY go.mod go.sum ./
COPY vendor vendor

RUN go mod verify

COPY pkg pkg
COPY build.go package.json ./

RUN go run build.go build

# Node build container
FROM node:12.13.0-alpine

# PhantomJS
RUN apk add --no-cache curl &&\
    cd /tmp && curl -Ls https://github.com/dustinblackman/phantomized/releases/download/2.1.1/dockerized-phantomjs.tar.gz | tar xz &&\
    cp -R lib lib64 / &&\
    cp -R usr/lib/x86_64-linux-gnu /usr/lib &&\
    cp -R usr/share /usr/share &&\
    cp -R etc/fonts /etc &&\
    curl -k -Ls https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.1.1-linux-x86_64.tar.bz2 | tar -jxf - &&\
    cp phantomjs-2.1.1-linux-x86_64/bin/phantomjs /usr/local/bin/phantomjs

WORKDIR /usr/src/app/

COPY package.json yarn.lock ./
COPY packages packages

RUN yarn install --pure-lockfile --no-progress

COPY Gruntfile.js tsconfig.json .eslintrc .editorconfig .browserslistrc ./
COPY public public
COPY scripts scripts
COPY emails emails

ENV NODE_ENV production
RUN ./node_modules/.bin/grunt build

# Final container
FROM alpine:3.10

LABEL maintainer="Grafana team <hello@grafana.com>"

ARG GF_UID="472"
ARG GF_GID="472"

ENV PATH="/usr/share/grafana/bin:$PATH" \
    GF_PATHS_CONFIG="/etc/grafana/grafana.ini" \
    GF_PATHS_DATA="/var/lib/grafana" \
    GF_PATHS_HOME="/usr/share/grafana" \
    GF_PATHS_LOGS="/var/log/grafana" \
    GF_PATHS_PLUGINS="/var/lib/grafana/plugins" \
    GF_PATHS_PROVISIONING="/etc/grafana/provisioning"

WORKDIR $GF_PATHS_HOME

RUN apk add --no-cache ca-certificates bash tzdata && \
    apk add --no-cache --upgrade --repository=http://dl-cdn.alpinelinux.org/alpine/edge/main openssl musl-utils

COPY conf ./conf

RUN mkdir -p "$GF_PATHS_HOME/.aws" && \
    addgroup -S -g $GF_GID grafana && \
    adduser -S -u $GF_UID -G grafana grafana && \
    mkdir -p "$GF_PATHS_PROVISIONING/datasources" \
             "$GF_PATHS_PROVISIONING/dashboards" \
             "$GF_PATHS_PROVISIONING/notifiers" \
             "$GF_PATHS_LOGS" \
             "$GF_PATHS_PLUGINS" \
             "$GF_PATHS_DATA" && \
    cp "$GF_PATHS_HOME/conf/sample.ini" "$GF_PATHS_CONFIG" && \
    cp "$GF_PATHS_HOME/conf/ldap.toml" /etc/grafana/ldap.toml && \
    chown -R grafana:grafana "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING" && \
    chmod -R 777 "$GF_PATHS_DATA" "$GF_PATHS_HOME/.aws" "$GF_PATHS_LOGS" "$GF_PATHS_PLUGINS" "$GF_PATHS_PROVISIONING"

# PhantomJS
COPY --from=1 /tmp/lib /lib
COPY --from=1 /tmp/lib64 /lib64
COPY --from=1 /tmp/usr/lib/x86_64-linux-gnu /usr/lib/x86_64-linux-gnu
COPY --from=1 /tmp/usr/share /usr/share
COPY --from=1 /tmp/etc/fonts /etc/fonts
COPY --from=1 /usr/local/bin/phantomjs /usr/local/bin

COPY --from=0 /go/src/github.com/grafana/grafana/bin/linux-amd64/grafana-server /go/src/github.com/grafana/grafana/bin/linux-amd64/grafana-cli ./bin/
COPY --from=1 /usr/src/app/public ./public
COPY --from=1 /usr/src/app/tools ./tools
COPY tools/phantomjs/render.js ./tools/phantomjs/render.js

EXPOSE 3000

COPY ./packaging/docker/run.sh /run.sh

USER grafana
ENTRYPOINT [ "/run.sh" ]
