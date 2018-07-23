#!/bin/bash

#
#   This script is executed from within the container.
#

CCX64=/tmp/x86_64-centos6-linux-gnu/bin/x86_64-centos6-linux-gnu-gcc

GOPATH=/go
REPO_PATH=$GOPATH/src/github.com/grafana/grafana

cd /go/src/github.com/grafana/grafana
echo "current dir: $(pwd)"

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Building releases from tag $CIRCLE_TAG"
  CC=${CCX64} go run build.go -includeBuildNumber=false build
else
  echo "Building incremental build for $CIRCLE_BRANCH"
  CC=${CCX64} go run build.go -buildNumber=${CIRCLE_BUILD_NUM} build
fi

yarn install --pure-lockfile --no-progress

echo "current dir: $(pwd)"

if [ -d "dist" ]; then
  rm -rf dist
fi

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Building frontend from tag $CIRCLE_TAG"
  go run build.go -includeBuildNumber=false build-frontend
  echo "Packaging a release from tag $CIRCLE_TAG"
  go run build.go -goos linux -pkg-arch amd64 -includeBuildNumber=false package-only latest
else
  echo "Building frontend for $CIRCLE_BRANCH"
  go run build.go -buildNumber=${CIRCLE_BUILD_NUM} build-frontend
  echo "Packaging incremental build for $CIRCLE_BRANCH"
  go run build.go -goos linux -pkg-arch amd64 -buildNumber=${CIRCLE_BUILD_NUM} package-only latest
fi
