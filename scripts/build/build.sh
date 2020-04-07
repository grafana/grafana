#!/bin/bash

# shellcheck disable=SC2086

#
#   This script is executed from within the container.
#
set -e

##########
CCARMV6=/opt/rpi-tools/arm-bcm2708/arm-linux-gnueabihf/bin/arm-linux-gnueabihf-gcc
CCARMV7=arm-linux-gnueabihf-gcc
CCARMV7_MUSL=/tmp/arm-linux-musleabihf-cross/bin/arm-linux-musleabihf-gcc
CCARM64=aarch64-linux-gnu-gcc
CCARM64_MUSL=/tmp/aarch64-linux-musl-cross/bin/aarch64-linux-musl-gcc
CCX64=/tmp/x86_64-centos6-linux-gnu/bin/x86_64-centos6-linux-gnu-gcc
CCX64_MUSL=/tmp/x86_64-linux-musl-cross/bin/x86_64-linux-musl-gcc

BUILD_FAST=0
BUILD_BACKEND=1
BUILD_FRONTEND=1
BUILD_PACKAGE=1

while [ "$1" != "" ]; do
  case "$1" in
    "--fast")
      BUILD_FAST=1
      echo "Fast build enabled"
      shift
      ;;
    "--backend-only")
      BUILD_FRONTEND=0
      BUILD_PACKAGE=0
      echo "Building only backend"
      shift
      ;;
    "--frontend-only")
      BUILD_BACKEND=0
      BUILD_PACKAGE=0
      echo "Building only frontend"
      shift
      ;;
    "--package-only")
      BUILD_BACKEND=0
      BUILD_FRONTEND=0
      echo "Building only packaging"
      shift
      ;;
    * )
      # unknown param causes args to be passed through to $@
      break
      ;;
  esac
done

# shellcheck disable=SC2124
EXTRA_OPTS="$@"

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

function build_backend_linux_amd64() {
  if [ ! -d "dist" ]; then
    mkdir dist
  fi
  CC=${CCX64} go run build.go ${OPT} build
  CC=${CCX64_MUSL} go run build.go -libc musl ${OPT} build
}

function build_backend() {
  if [ ! -d "dist" ]; then
    mkdir dist
  fi

  go run build.go -goarch armv6 -cc ${CCARMV6} ${OPT} build
  go run build.go -goarch armv7 -cc ${CCARMV7} ${OPT} build
  go run build.go -goarch arm64 -cc ${CCARM64} ${OPT} build
  go run build.go -goarch armv7 -libc musl -cc ${CCARMV7_MUSL} ${OPT} build
  go run build.go -goarch arm64 -libc musl -cc ${CCARM64_MUSL} ${OPT} build
  build_backend_linux_amd64
}

function build_frontend() {
  if [ ! -d "dist" ]; then
    mkdir dist
  fi
  yarn install --pure-lockfile --no-progress
  echo "Building frontend"

  start=$(date +%s%N)
  go run build.go ${OPT} build-frontend
  runtime=$((($(date +%s%N) - start)/1000000))
  echo "Frontent build took: $runtime ms"
  echo "FRONTEND: finished"
}

function package_linux_amd64() {
  echo "Packaging Linux AMD64"
  go run build.go -goos linux -pkg-arch amd64 ${OPT} package-only
  go run build.go -goos linux -pkg-arch amd64 ${OPT} -libc musl -skipRpm -skipDeb package-only
  go run build.go latest
  echo "PACKAGE LINUX AMD64: finished"
}

function package_all() {
  echo "Packaging ALL"
  go run build.go -goos linux -pkg-arch armv6 ${OPT} -skipRpm package-only
  go run build.go -goos linux -pkg-arch armv7 ${OPT} package-only
  go run build.go -goos linux -pkg-arch arm64 ${OPT} package-only
  go run build.go -goos linux -pkg-arch armv7 -libc musl -skipRpm -skipDeb ${OPT} package-only
  go run build.go -goos linux -pkg-arch arm64 -libc musl -skipRpm -skipDeb ${OPT} package-only
  package_linux_amd64
  echo "PACKAGE ALL: finished"
}

function package_setup() {
  echo "Packaging: Setup environment"
  if [ -d "dist" ]; then
    rm -rf dist
  fi
  mkdir dist
  go run build.go -gen-version ${OPT} > dist/grafana.version
  # Load ruby, needed for packing with fpm
  # shellcheck disable=SC1091
  source /etc/profile.d/rvm.sh
}

if [ $BUILD_FAST = "0" ]; then
  build_backend
  build_frontend
  package_setup
  package_all
else
  if [ $BUILD_BACKEND = "1" ]; then
    build_backend_linux_amd64
  fi
  if [ $BUILD_FRONTEND = "1" ]; then
    build_frontend
  fi
  if [ $BUILD_PACKAGE = "1" ]; then
    package_setup
    package_linux_amd64
    # last step
    #go run build.go latest
  fi
fi
