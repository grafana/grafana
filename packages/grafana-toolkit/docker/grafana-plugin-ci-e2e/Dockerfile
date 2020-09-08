FROM debian:buster-slim

USER root

COPY scripts scripts
COPY install /usr/local

RUN cd scripts && ./deploy.sh
