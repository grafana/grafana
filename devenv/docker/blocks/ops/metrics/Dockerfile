FROM prom/prometheus AS prom

FROM node:lts-slim

COPY --from=prom /bin/prometheus /bin/prometheus
COPY --from=prom /bin/promtool /bin/promtool
COPY --from=prom /etc/prometheus/prometheus.yml /etc/prometheus/prometheus.yml
COPY --from=prom /prometheus/ /prometheus
COPY --from=prom /usr/share/prometheus/console_libraries/ /usr/share/prometheus/console_libraries/
COPY --from=prom /usr/share/prometheus/consoles/ /usr/share/prometheus/consoles/


RUN ln -s /usr/share/prometheus/console_libraries /usr/share/prometheus/consoles/ /etc/prometheus/ && \
    chown -R node:node /etc/prometheus

WORKDIR /app
