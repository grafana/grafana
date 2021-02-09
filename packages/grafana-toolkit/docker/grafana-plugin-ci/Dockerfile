FROM debian:testing-20210111-slim
USER root
COPY scripts scripts
WORKDIR scripts
RUN ./deploy.sh
COPY install/gget /usr/local/bin/gget
