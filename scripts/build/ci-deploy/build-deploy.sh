#!/bin/bash

_version="1.2.1"
_tag="grafana/grafana-ci-deploy:${_version}"

docker build -t $_tag .
docker push $_tag
