ARG GRAFANA_VERSION="latest"

FROM grafana/grafana:${GRAFANA_VERSION}

USER root

# Add default provisioning service paths
RUN mkdir -p /etc/grafana/provisioning/notifiers     \
             /etc/grafana/provisioning/datasources   \
             /etc/grafana/provisioning/dashboards && \
    chmod -R 755 /etc/grafana/provisioning

# Assert permissions for default configuration path
RUN chown -R grafana:grafana /etc/grafana/

USER grafana

ARG GF_INSTALL_PLUGINS=""

RUN if [ ! -z "${GF_INSTALL_PLUGINS}" ]; then \
    OLDIFS=$IFS; \
        IFS=','; \
    for plugin in ${GF_INSTALL_PLUGINS}; do \
        IFS=$OLDIFS; \
        grafana-cli --pluginsDir "$GF_PATHS_PLUGINS" plugins install ${plugin}; \
    done; \
fi
