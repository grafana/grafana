#!/bin/bash

docker run -i -t \
  -v /home/ubuntu/.go_workspace:/go \
  --name gfbuild grafana/buildcontainer
