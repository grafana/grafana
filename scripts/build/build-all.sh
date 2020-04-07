#!/bin/bash

# shellcheck disable=SC2086

# shellcheck source=./scripts/helpers/exit-if-fail.sh
source "$(dirname "$0")/../helpers/exit-if-fail.sh"
#
#   This script is executed from within the container.
#

set -e

# shellcheck disable=SC2124
EXTRA_OPTS="$@"

CCARMV6=/opt/rpi-tools/arm-bcm2708/arm-linux-gnueabihf/bin/arm-linux-gnueabihf-gcc
CCARMV7=arm-linux-gnueabihf-gcc
CCARMV7_MUSL=/tmp/arm-linux-musleabihf-cross/bin/arm-linux-musleabihf-gcc
CCARM64=aarch64-linux-gnu-gcc
CCARM64_MUSL=/tmp/aarch64-linux-musl-cross/bin/aarch64-linux-musl-gcc
CCOSX64=/tmp/osxcross/target/bin/o64-clang
CCWIN64=x86_64-w64-mingw32-gcc
CCX64=/tmp/x86_64-centos6-linux-gnu/bin/x86_64-centos6-linux-gnu-gcc
CCX64_MUSL=/tmp/x86_64-linux-musl-cross/bin/x86_64-linux-musl-gcc

cd /go/src/github.com/grafana/grafana
echo "current dir: $(pwd)"

function reportFrontEndBuildTime() {
  if echo "$EXTRA_OPTS" | grep -vq enterprise ; then
    # Only report for build job
    # build-enterprise happens right after build on master
    # so there is no need for reporting the same metric again
    exit_if_fail ./scripts/ci-metrics-publisher.sh "grafana.ci-performance.frontend-build=$1"
  fi
}


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
go run build.go -goarch armv7 -libc musl -cc ${CCARMV7_MUSL} ${OPT} build
go run build.go -goarch arm64 -libc musl -cc ${CCARM64_MUSL} ${OPT} build
go run build.go -goos darwin -cc ${CCOSX64} ${OPT} build


go run build.go -goos windows -cc ${CCWIN64} ${OPT} build

# Do not remove CC from the linux build, its there for compatibility with Centos6
go run build.go -cc ${CCX64} ${OPT} build

go run build.go -cc ${CCX64_MUSL} -libc musl ${OPT} build

yarn install --pure-lockfile --no-progress

if [ "$CIRCLE_TAG" != "" ]; then
  echo "Building frontend and packaging from tag $CIRCLE_TAG"
else
  echo "Building frontend and packaging incremental build for $CIRCLE_BRANCH"
fi
echo "Building frontend"
start=$(date +%s%N)
go run build.go ${OPT} build-frontend
runtime=$((($(date +%s%N) - start)/1000000))
echo "Frontent build took $runtime"
reportFrontEndBuildTime $runtime

if [ -d "dist" ]; then
  rm -rf dist
fi

mkdir dist
go run build.go -gen-version ${OPT} > dist/grafana.version

# Load ruby, needed for packing with fpm
# shellcheck disable=SC1091
source /etc/profile.d/rvm.sh

echo "Packaging"
go run build.go -goos linux -pkg-arch amd64 ${OPT} package-only
go run build.go -goos linux -pkg-arch amd64 -libc musl ${OPT} -skipRpm -skipDeb package-only
#removing amd64 phantomjs bin for armv7/arm64 packages
rm tools/phantomjs/phantomjs

go run build.go -goos linux -pkg-arch armv6 ${OPT} -skipRpm package-only
go run build.go -goos linux -pkg-arch armv7 ${OPT} package-only
go run build.go -goos linux -pkg-arch arm64 ${OPT} package-only
go run build.go -goos linux -pkg-arch armv7 -libc musl ${OPT} -skipRpm -skipDeb package-only
go run build.go -goos linux -pkg-arch arm64 -libc musl ${OPT} -skipRpm -skipDeb package-only

if [ -d '/tmp/phantomjs/darwin' ]; then
  cp /tmp/phantomjs/darwin/phantomjs tools/phantomjs/phantomjs
else
  echo 'PhantomJS binaries for darwin missing!'
fi
go run build.go -goos darwin -pkg-arch amd64 ${OPT} package-only

if [ -d '/tmp/phantomjs/windows' ]; then
  cp /tmp/phantomjs/windows/phantomjs.exe tools/phantomjs/phantomjs.exe
  rm tools/phantomjs/phantomjs || true
else
    echo 'PhantomJS binaries for Windows missing!'
fi

cp /usr/local/go/lib/time/zoneinfo.zip tools/zoneinfo.zip
go run build.go -goos windows -pkg-arch amd64 ${OPT} package-only
rm tools/zoneinfo.zip

go run build.go latest
