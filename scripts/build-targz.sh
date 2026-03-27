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
FILENAME="${TARGZ_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_${OS}_${ARCH}.tar.gz"
STAGING="${REPO_ROOT}/dist/.tar-staging"
ROOT="grafana-${BUILD_VERSION}"
DIR="${STAGING}/${ROOT}"

echo "build tar.gz: ${FILENAME}"

rm -rf "${STAGING}"
mkdir -p "${DIR}/tools" "${DIR}/docs" "${DIR}/packaging"

echo "${BUILD_VERSION}" > "${DIR}/VERSION"
cp LICENSE NOTICE.md README.md Dockerfile "${DIR}/"
cp "$("${GO}" env GOROOT)/lib/time/zoneinfo.zip" "${DIR}/tools/"

cp -r conf "${DIR}/conf"
cp -r docs/sources "${DIR}/docs/sources"
cp -r packaging/deb "${DIR}/packaging/deb"
cp -r packaging/rpm "${DIR}/packaging/rpm"
cp -r packaging/docker "${DIR}/packaging/docker"
cp -r packaging/wrappers "${DIR}/packaging/wrappers"

mkdir -p "${DIR}/bin"
cp "bin/${OS}/${ARCH}/"* "${DIR}/bin/"
cp -r public "${DIR}/public"
find "${DIR}/public" -type d -name node_modules -print0 | xargs -0 rm -rf 2>/dev/null || true

if [ -d plugins-bundled ]; then
  cp -r plugins-bundled "${DIR}/plugins-bundled"
  find "${DIR}/plugins-bundled" -type d -name node_modules -print0 | xargs -0 rm -rf 2>/dev/null || true
else
  mkdir -p "${DIR}/plugins-bundled"
fi

mkdir -p dist
(cd "${STAGING}" && tar -czf "${REPO_ROOT}/dist/${FILENAME}" "${ROOT}")
rm -rf "${STAGING}"

echo "created dist/${FILENAME}"
