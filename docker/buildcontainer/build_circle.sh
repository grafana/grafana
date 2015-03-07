#!/bin/bash

docker kill gfbuild
docker rm gfbuild

docker build --tag "grafana/buildcontainer" .

docker run -i -t \
  -v /home/ubuntu/.go_workspace:/go \
  --name gfbuild grafana/buildcontainer
