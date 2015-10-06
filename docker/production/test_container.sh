#!/bin/bash

docker run -i -p 3001:3000 \
  -e "GF_SERVER_ROOT_URL=http://grafana.server.name"  \
  grafana/grafana:develop
