ARG BASE_IMAGE=debian:stretch-slim
FROM ${BASE_IMAGE}

ARG GRAFANA_TGZ="grafana-latest.linux-x64.tar.gz"

RUN apt-get update && apt-get install -qq -y tar && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY ${GRAFANA_TGZ} /tmp/grafana.tar.gz

RUN mkdir /tmp/grafana && tar xfvz /tmp/grafana.tar.gz --strip-components=1 -C /tmp/grafana

ARG BASE_IMAGE=debian:stretch-slim
FROM ${BASE_IMAGE}

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

RUN apt-get update && apt-get -y upgrade && \
    apt-get install -qq -y libfontconfig ca-certificates curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

RUN groupadd -r -g $GF_GID grafana && \
    useradd -r -u $GF_UID -g grafana grafana

COPY --chown=grafana:grafana --from=0 /tmp/grafana "$GF_PATHS_HOME"

COPY ./run.sh /run.sh

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
