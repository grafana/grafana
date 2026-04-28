#!/usr/bin/env bash
set -euo pipefail

# Build a .deb package from an existing tar.gz package using fpm.
#
# Environment variables (with defaults where appropriate):
#   TARGZ_PACKAGE_NAME  – package name, e.g. "grafana" or "grafana-enterprise"
#   BUILD_VERSION       – semver build version
#   BUILD_NUMBER        – CI build number / ID
#   OS                  – target OS (must be linux)
#   ARCH                – target architecture (e.g. amd64, arm64)
#   GOARM               – ARM version (e.g. 6, 7) for ARM builds

: "${TARGZ_PACKAGE_NAME:=grafana}"
: "${BUILD_VERSION:?BUILD_VERSION is required}"
: "${BUILD_NUMBER:=local}"
: "${OS:?OS is required}"
: "${ARCH:?ARCH is required}"

REPO_ROOT="$(pwd)"

# Match pkg/build/daggerbuild/packages.FileName: arm variants use arch labels like arm-6, arm-7.
ARCH_LABEL="${ARCH}"
if [ -n "${GOARM:-}" ]; then
  ARCH_LABEL="${ARCH}-${GOARM}"
fi

# Match daggerbuild RPI flag: armv6 packages use a -rpi suffix (grafana-rpi, grafana-enterprise-rpi).
DEB_PACKAGE_NAME="${TARGZ_PACKAGE_NAME}"
if [ "${GOARM:-}" = "6" ]; then
  DEB_PACKAGE_NAME="${TARGZ_PACKAGE_NAME}-rpi"
fi

# Match pkg/build/daggerbuild/backend.PackageArch: arm -> armhf.
PKG_ARCH="${ARCH}"
if [ "${ARCH}" = "arm" ]; then
  PKG_ARCH="armhf"
fi

# Match artifacts/package_deb.go debVersion(): replace +security- with -.
# Also strip leading 'v' prefix (fpm.Build: strings.TrimPrefix(opts.Version, "v")).
DEB_VERSION="${BUILD_VERSION#v}"
DEB_VERSION="${DEB_VERSION//+security-/-}"

TARGZ="${REPO_ROOT}/dist/${TARGZ_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_${OS}_${ARCH_LABEL}.tar.gz"
if [ ! -f "${TARGZ}" ]; then
  echo "error: tar.gz not found: ${TARGZ}" >&2
  echo "       run 'make build-targz' first" >&2
  exit 1
fi

STAGING=$(mktemp -d)
trap 'rm -rf "${STAGING}"' EXIT

SRC="${STAGING}/src"
PKG="${STAGING}/pkg"

mkdir -p "${SRC}"

echo "build deb: ${DEB_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_${OS}_${ARCH_LABEL}.deb"

tar --exclude=storybook --strip-components=1 -xf "${TARGZ}" -C "${SRC}"

# Create package directory structure (matches fpm/build.go packagePaths).
mkdir -p \
  "${PKG}/usr/sbin" \
  "${PKG}/usr/share" \
  "${PKG}/etc/default" \
  "${PKG}/etc/grafana" \
  "${PKG}/usr/lib/systemd/system" \
  "${PKG}/etc/init.d"

# Wrapper scripts for the unified grafana binary.
cp \
  "${SRC}/packaging/wrappers/grafana" \
  "${SRC}/packaging/wrappers/grafana-server" \
  "${SRC}/packaging/wrappers/grafana-cli" \
  "${PKG}/usr/sbin/"
# System files in /usr/sbin must have 0755 or less permissive.
chmod 0755 \
  "${PKG}/usr/sbin/grafana" \
  "${PKG}/usr/sbin/grafana-server" \
  "${PKG}/usr/sbin/grafana-cli"

# Copy full grafana tree under /usr/share/grafana.
cp -r "${SRC}" "${PKG}/usr/share/grafana"

# Copy deb-specific config files (matches artifacts/package_deb.go ConfigFiles).
cp "${SRC}/packaging/deb/default/grafana-server"              "${PKG}/etc/default/grafana-server"
cp "${SRC}/packaging/deb/init.d/grafana-server"               "${PKG}/etc/init.d/grafana-server"
cp "${SRC}/packaging/deb/systemd/grafana-server.service"      "${PKG}/usr/lib/systemd/system/grafana-server.service"
# Config files must have 0644 or less permissive; init.d scripts must have 0755 or less permissive.
chmod 0755 "${PKG}/etc/init.d/grafana-server"
chmod 0644 "${PKG}/etc/default/grafana-server"

FILENAME="${DEB_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_${OS}_${ARCH_LABEL}.deb"

mkdir -p dist

fpm \
  --input-type=dir \
  --chdir="${PKG}" \
  --output-type=deb \
  --vendor="Grafana Labs" \
  --url=https://grafana.com \
  --maintainer=contact@grafana.com \
  --version="${DEB_VERSION}" \
  --package="${REPO_ROOT}/dist/${FILENAME}" \
  --config-files=/etc/default/grafana-server \
  --config-files=/etc/init.d/grafana-server \
  --config-files=/usr/lib/systemd/system/grafana-server.service \
  --after-install="${SRC}/packaging/deb/control/postinst" \
  --before-remove="${SRC}/packaging/deb/control/prerm" \
  --depends=adduser \
  --architecture="${PKG_ARCH}" \
  --description=Grafana \
  --license="${FPM_LICENSE:-AGPLv3}" \
  --name="${DEB_PACKAGE_NAME}" \
  --deb-no-default-config-files \
  --deb-compression xz \
  .

echo "created dist/${FILENAME}"
