#!/bin/bash

#
#   This script is executed from within the container.
#

GOPATH=/go
REPO_PATH=$GOPATH/src/github.com/grafana/grafana

cd /go/src/github.com/grafana/grafana
echo "current dir: $(pwd)"

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Building a release from tag $CIRCLE_TAG"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} -includeBuildNumber=false build
else
  echo "Building incremental build for $CIRCLE_BRANCH"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} build
fi

yarn install --pure-lockfile --no-progress

source /etc/profile.d/rvm.sh
rvm use 2.1.9 --default

gem install fpm -v 1.4

echo "current dir: $(pwd)"

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Packaging a release from tag $CIRCLE_TAG"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} -includeBuildNumber=false package latest
else
  echo "Packaging incremental build for $CIRCLE_BRANCH"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} package latest
fi
