#!/bin/bash

#
#   This script is executed from within the container.
#

CCARMV7=arm-linux-gnueabihf-gcc
CCARM64=aarch64-linux-gnu-gcc
CCOSX64=/tmp/osxcross/target/bin/o64-clang
CCWIN64=x86_64-w64-mingw32-gcc
CCX64=/tmp/x86_64-centos6-linux-gnu/bin/x86_64-centos6-linux-gnu-gcc

GOPATH=/go
REPO_PATH=$GOPATH/src/github.com/grafana/grafana

cd /go/src/github.com/grafana/grafana
echo "current dir: $(pwd)"

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Building releases from tag $CIRCLE_TAG"
  OPT="-includeBuildNumber=false"
else
  echo "Building incremental build for $CIRCLE_BRANCH"
  OPT="-buildNumber=${CIRCLE_BUILD_NUM}"
fi

go run build.go -goarch armv7 -cc ${CCARMV7} ${OPT} build
go run build.go -goarch arm64 -cc ${CCARM64} ${OPT} build
go run build.go -goos darwin -cc ${CCOSX64} ${OPT} build
go run build.go -goos windows -cc ${CCWIN64} ${OPT} build
CC=${CCX64} go run build.go ${OPT} build

yarn install --pure-lockfile --no-progress

echo "current dir: $(pwd)"

if [ -d "dist" ]; then
  rm -rf dist
fi

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Building frontend and packaging from tag $CIRCLE_TAG"
else
  echo "Building frontend and packaging incremental build for $CIRCLE_BRANCH"
fi
echo "Building frontend"
go run build.go ${OPT} build-frontend
echo "Packaging"
go run build.go -goos linux -pkg-arch amd64 ${OPT} package-only latest
#removing amd64 phantomjs bin for armv7/arm64 packages
rm tools/phantomjs/phantomjs
go run build.go -goos linux -pkg-arch armv7 ${OPT} package-only
go run build.go -goos linux -pkg-arch arm64 ${OPT} package-only

if [ -d '/tmp/phantomjs/darwin' ]; then
  cp /tmp/phantomjs/darwin/phantomjs tools/phantomjs/phantomjs
else
  echo 'PhantomJS binaries for darwin missing!'
fi
go run build.go -goos darwin -pkg-arch amd64 ${OPT} package-only

if [ -d '/tmp/phantomjs/windows' ]; then
  cp /tmp/phantomjs/windows/phantomjs.exe tools/phantomjs/phantomjs.exe
  rm tools/phantomjs/phantomjs
else
    echo 'PhantomJS binaries for darwin missing!'
fi
go run build.go -goos windows -pkg-arch amd64 ${OPT} package-only

