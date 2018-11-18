#!/bin/bash

#
#   This script is executed from within the container.
#

set -e

EXTRA_OPTS="$@"

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

CC=${CCX64} go run build.go ${OPT} build

yarn install --pure-lockfile --no-progress

echo "current dir: $(pwd)"

if [ -d "dist" ]; then
  rm -rf dist
fi

echo "Building frontend"
go run build.go ${OPT} build-frontend

# Load ruby, needed for packing with fpm
source /etc/profile.d/rvm.sh

echo "Packaging"
go run build.go -goos linux -pkg-arch amd64 ${OPT} package-only latest
