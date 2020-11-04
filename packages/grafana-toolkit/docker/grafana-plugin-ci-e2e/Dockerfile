FROM debian:buster-slim

USER root
ENV DEBIAN_FRONTEND=noninteractive

COPY scripts scripts
COPY install /usr/local

RUN cd scripts && ./deploy.sh
ENV DEBIAN_FRONTEND=newt
