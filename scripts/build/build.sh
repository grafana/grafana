#!/bin/bash

#
#   This script is executed from within the container.
#

GOPATH=/go
REPO_PATH=$GOPATH/src/github.com/grafana/grafana

mkdir -p /go/src/github.com/grafana
cd /go/src/github.com/grafana

if [ -n "${CIRCLE_TAG}" ]; then
  echo "Building from tag ${CIRCLE_TAG}"
  git clone --depth 1 https://github.com/grafana/grafana.git -b $CIRCLE_BRANCH
  cd $REPO_PATH
else
  echo "Building from branch ${CIRCLE_BRANCH}"
  git clone https://github.com/grafana/grafana.git
  cd $REPO_PATH
  git checkout $CIRCLE_TAG
fi

go run build.go build
yarn install --pure-lockfile

source /etc/profile.d/rvm.sh
rvm use 2.1.9 --default

gem install fpm -v 1.4

if [ -n "${CIRCLE_TAG}" ]; then
  go run build.go -includeBuildNumber=false package latest
else
  go run build.go package latest
fi

cp dist/* /tmp/dist/


