#!/bin/bash

docker kill gfbuild
docker rm gfbuild

docker build --tag "grafana/buildcontainer" .

docker run -i -t \
  -v /home/torkel/dev/go:/go \
 --name gfbuild grafana/buildcontainer /bin/bash
