#!/bin/bash

#if have any docker
# should run "docker run -i -t cloudwiz.cn/grafana"
docker start d01c24142d71
docker exec d01c24142d71 /go/src/github.com/wangy1931/grafana/release.sh
docker stop d01c24142d71