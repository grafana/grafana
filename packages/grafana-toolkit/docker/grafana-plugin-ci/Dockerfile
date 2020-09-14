FROM circleci/node:12-browsers
USER root
COPY scripts scripts
WORKDIR scripts
RUN ./deploy.sh
COPY install/gget /usr/local/bin/gget
