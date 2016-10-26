FROM grafana/docs-base:latest

# to get the git info for this repo
# COPY config.toml /site

RUN rm -rf /site/content/*

COPY ./sources /site/content/

COPY awsconfig /site

VOLUME ["/site/content"]
