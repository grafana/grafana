ARG BASE_IMAGE=alpine:3.10
FROM alpine:3.10

ARG GRAFANA_TGZ="grafana-latest.linux-x64.tar.gz"

COPY ${GRAFANA_TGZ} /tmp/grafana.tar.gz

# Change to tar xfzv to make tar print every file it extracts
RUN mkdir /tmp/grafana && tar xfz /tmp/grafana.tar.gz --strip-components=1 -C /tmp/grafana

# PhantomJS
FROM alpine:3.10

RUN apk add --no-cache curl &&\
    cd /tmp && curl -Ls https://github.com/dustinblackman/phantomized/releases/download/2.1.1/dockerized-phantomjs.tar.gz | tar xz &&\
    cp -R lib lib64 / &&\
    cp -R usr/lib/x86_64-linux-gnu /usr/lib &&\
    cp -R usr/share /usr/share &&\
    cp -R etc/fonts /etc &&\
    curl -k -Ls https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.1.1-linux-x86_64.tar.bz2 | tar -jxf - &&\
    cp phantomjs-2.1.1-linux-x86_64/bin/phantomjs /usr/local/bin/phantomjs

FROM ${BASE_IMAGE}

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

RUN apk add --no-cache ca-certificates bash

# PhantomJS
COPY --from=1 /tmp/lib /lib
COPY --from=1 /tmp/lib64 /lib64
COPY --from=1 /tmp/usr/lib/x86_64-linux-gnu /usr/lib/x86_64-linux-gnu
COPY --from=1 /tmp/usr/share /usr/share
COPY --from=1 /tmp/etc/fonts /etc/fonts
COPY --from=1 /usr/local/bin/phantomjs /usr/local/bin

COPY --from=0 /tmp/grafana "$GF_PATHS_HOME"

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

EXPOSE 3000

COPY ./run.sh /run.sh

USER grafana
ENTRYPOINT [ "/run.sh" ]
