FROM grafana/docs-base:latest

# to get the git info for this repo
# COPY config.toml /site

# RUN rm -rf /site/content/*

# COPY ./sources /site/content/docs/

COPY config.toml /site
COPY awsconfig /site
COPY versions.json /site/static/js

VOLUME ["/site/content"]
