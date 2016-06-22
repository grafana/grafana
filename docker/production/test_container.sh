#!/bin/bash

docker run -i -p 3001:3000 \
  -e "GF_SERVER_ROOT_URL=http://grafana.server.name"  \
  docker.hikvision.com.cn/prometheus/grafana:1.0
