#!/bin/bash

docker kill gfbuild
docker rm gfbuild

docker build --tag "cloudwiz.cn/grafana" docker/buildcontainer
