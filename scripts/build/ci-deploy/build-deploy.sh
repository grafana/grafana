#!/bin/bash

_version="1.0.0"
_tag="grafana/grafana-ci-deploy:${_version}"

docker build -t $_tag .
docker push $_tag
