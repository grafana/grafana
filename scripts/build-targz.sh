#!/usr/bin/env bash
set -euo pipefail

# Environment variables (with defaults where appropriate):
#   TARGZ_PACKAGE_NAME  – package name, e.g. "grafana" or "grafana-enterprise"
#   BUILD_VERSION       – semver build version
#   BUILD_NUMBER        – CI build number / ID
#   OS                  – target OS (e.g. linux, darwin)
#   ARCH                – target architecture (e.g. amd64, arm64)
#   GO                  – path to 'go'. default: 'go' (determined by $PATH by default).

: "${TARGZ_PACKAGE_NAME:=grafana}"
: "${BUILD_VERSION:?BUILD_VERSION is required}"
: "${BUILD_NUMBER:=local}"
: "${OS:?OS is required}"
: "${ARCH:?ARCH is required}"
: "${GO:=go}"

REPO_ROOT="$(pwd)"
# Match pkg/build/daggerbuild/packages.FileName: arm variants use arch labels like arm-6, arm-7.
ARCH_LABEL="${ARCH}"
if [ -n "${GOARM:-}" ]; then
  ARCH_LABEL="${ARCH}-${GOARM}"
fi
FILENAME="${TARGZ_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_${OS}_${ARCH_LABEL}.tar.gz"
STAGING="${REPO_ROOT}/dist/.tar-staging"
ROOT="grafana-${BUILD_VERSION}"
DIR="${STAGING}/${ROOT}"

echo "build tar.gz: ${FILENAME}"

if [[ ! -d "${REPO_ROOT}/conf" ]]; then
  echo "error: ${REPO_ROOT}/conf is missing; cannot package" >&2
  exit 1
fi

rm -rf "${STAGING}"
mkdir -p "${DIR}/tools" "${DIR}/docs" "${DIR}/packaging"

echo "${BUILD_VERSION}" > "${DIR}/VERSION"
cp LICENSE NOTICE.md README.md Dockerfile "${DIR}/"
cp "$("${GO}" env GOROOT)/lib/time/zoneinfo.zip" "${DIR}/tools/"

cp -r conf "${DIR}/conf"

mkdir -p "${DIR}/data"
if [[ -d "${REPO_ROOT}/data/plugins-bundled" ]]; then
  cp -a "${REPO_ROOT}/data/plugins-bundled" "${DIR}/data/"
  find "${DIR}/data/plugins-bundled" -type d -name node_modules -print0 2>/dev/null | xargs -0 rm -rf || true
else
  mkdir -p "${DIR}/data/plugins-bundled"
fi

cp -r docs/sources "${DIR}/docs/sources"
cp -r packaging/deb "${DIR}/packaging/deb"
cp -r packaging/rpm "${DIR}/packaging/rpm"
cp -r packaging/docker "${DIR}/packaging/docker"
cp -r packaging/wrappers "${DIR}/packaging/wrappers"

mkdir -p "${DIR}/bin"
cp "bin/${OS}/${ARCH}/"* "${DIR}/bin/"

# This directory is unused, but it is preserved for backwards compatibility.
# Bundled plugins are in 'data/plugins-bundled' now.
mkdir -p "${DIR}/plugins-bundled"

cp -r public "${DIR}/public"
find "${DIR}/public" -type d -name node_modules -print0 | xargs -0 rm -rf 2>/dev/null || true

mkdir -p dist
(cd "${STAGING}" && tar -czf "${REPO_ROOT}/dist/${FILENAME}" "${ROOT}")
rm -rf "${STAGING}"

echo "created dist/${FILENAME}"
