ARG BASE_IMAGE=ubuntu:latest
FROM ${BASE_IMAGE}

ARG GRAFANA_TGZ="grafana-latest.linux-x64.tar.gz"

RUN apt-get update && apt-get install -qq -y tar && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY ${GRAFANA_TGZ} /tmp/grafana.tar.gz

# Change to tar xfzv to make tar print every file it extracts
RUN mkdir /tmp/grafana && tar xfz /tmp/grafana.tar.gz --strip-components=1 -C /tmp/grafana

ARG BASE_IMAGE=ubuntu:latest
FROM ${BASE_IMAGE}

ARG GF_UID="472"
ARG GF_GID="472"
ARG DEBIAN_FRONTEND=noninteractive

ENV PATH=/usr/share/grafana/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    GF_PATHS_CONFIG="/etc/grafana/grafana.ini" \
    GF_PATHS_DATA="/var/lib/grafana" \
    GF_PATHS_HOME="/usr/share/grafana" \
    GF_PATHS_LOGS="/var/log/grafana" \
    GF_PATHS_PLUGINS="/var/lib/grafana/plugins" \
    GF_PATHS_PROVISIONING="/etc/grafana/provisioning"

WORKDIR $GF_PATHS_HOME

RUN apt-get update && apt-get -y upgrade && \
    apt-get install -qq -y libfontconfig1 ca-certificates curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

COPY --from=0 /tmp/grafana "$GF_PATHS_HOME"

RUN mkdir -p "$GF_PATHS_HOME/.aws" && \
    groupadd -r -g $GF_GID grafana && \
    useradd -r -u $GF_UID -g grafana grafana && \
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
