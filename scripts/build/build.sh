#!/bin/bash

#
#   This script is executed from within the container.
#

set -e

EXTRA_OPTS="$@"

CCARMV6=/opt/rpi-tools/arm-bcm2708/arm-linux-gnueabihf/bin/arm-linux-gnueabihf-gcc
CCARMV7=arm-linux-gnueabihf-gcc
CCARM64=aarch64-linux-gnu-gcc
CCX64=/tmp/x86_64-centos6-linux-gnu/bin/x86_64-centos6-linux-gnu-gcc

GOPATH=/go
REPO_PATH=$GOPATH/src/github.com/grafana/grafana

cd /go/src/github.com/grafana/grafana
echo "current dir: $(pwd)"

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Building releases from tag $CIRCLE_TAG"
  OPT="-includeBuildId=false ${EXTRA_OPTS}"
else
  echo "Building incremental build for $CIRCLE_BRANCH"
  OPT="-buildId=${CIRCLE_WORKFLOW_ID} ${EXTRA_OPTS}"
fi


echo "Build arguments: $OPT"
echo "current dir: $(pwd)"

go run build.go -goarch armv6 -cc ${CCARMV6} ${OPT} build
go run build.go -goarch armv7 -cc ${CCARMV7} ${OPT} build
go run build.go -goarch arm64 -cc ${CCARM64} ${OPT} build

CC=${CCX64} go run build.go ${OPT} build

yarn install --pure-lockfile --no-progress

echo "Building frontend"
go run build.go ${OPT} build-frontend

if [ -d "dist" ]; then
  rm -rf dist
fi

mkdir dist
go run build.go -gen-version ${OPT} > dist/grafana.version

# Load ruby, needed for packing with fpm
source /etc/profile.d/rvm.sh

echo "Packaging"
go run build.go -goos linux -pkg-arch amd64 ${OPT} package-only
go run build.go -goos linux -pkg-arch armv6 ${OPT} -skipRpm package-only
go run build.go -goos linux -pkg-arch armv7 ${OPT} package-only
go run build.go -goos linux -pkg-arch arm64 ${OPT} package-only

go run build.go latest
