FROM debian:testing-20210111-slim

ENV DEBIAN_FRONTEND=noninteractive

COPY scripts scripts
COPY install /usr/local

RUN cd scripts && ./deploy.sh
ENV DEBIAN_FRONTEND=newt
