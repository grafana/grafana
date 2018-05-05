#!/bin/bash

docker info && docker version
mkdir -p ~/docker

echo "Circle branch: ${CIRCLE_BRANCH}"
echo "Circle tag: ${CIRCLE_TAG}"

# try to load docker container from cache
if [[ -e ~/docker/centos.tar ]]; then
  docker load -i ~/docker/centos.tar;
else
  docker build --rm=false --tag "grafana/buildcontainer" ./scripts/build/

  # save docker container so we don't have to recreate it next run
  docker save grafana/buildcontainer > ~/docker/centos.tar;
fi
