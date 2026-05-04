#!/usr/bin/env bash
set -euo pipefail

# Build an .rpm package from an existing tar.gz package using fpm.
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

# Match pkg/build/daggerbuild/backend.PackageArch: arm -> armhf.
PKG_ARCH="${ARCH}"
if [ "${ARCH}" = "arm" ]; then
  PKG_ARCH="armhf"
fi

# Match artifacts/package_rpm.go rpmVersion(): replace + with ^.
# Also strip leading 'v' prefix (fpm.Build: strings.TrimPrefix(opts.Version, "v")).
RPM_VERSION="${BUILD_VERSION#v}"
RPM_VERSION="${RPM_VERSION//+/^}"

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

echo "build rpm: ${TARGZ_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_${OS}_${ARCH_LABEL}.rpm"

tar --exclude=storybook --strip-components=1 -xf "${TARGZ}" -C "${SRC}"

# Create package directory structure (matches fpm/build.go packagePaths; RPM has no init.d).
mkdir -p \
  "${PKG}/usr/sbin" \
  "${PKG}/usr/share" \
  "${PKG}/etc/sysconfig" \
  "${PKG}/etc/grafana" \
  "${PKG}/usr/lib/systemd/system"

# Wrapper scripts for the unified grafana binary.
cp \
  "${SRC}/packaging/wrappers/grafana" \
  "${SRC}/packaging/wrappers/grafana-server" \
  "${SRC}/packaging/wrappers/grafana-cli" \
  "${PKG}/usr/sbin/"
# System files in /usr/sbin must have 0755 or less permissive (DISA-STIG RHEL-09-232010).
chmod 0755 \
  "${PKG}/usr/sbin/grafana" \
  "${PKG}/usr/sbin/grafana-server" \
  "${PKG}/usr/sbin/grafana-cli"

# Copy full grafana tree under /usr/share/grafana.
cp -r "${SRC}" "${PKG}/usr/share/grafana"

# Copy rpm-specific config files (matches artifacts/package_rpm.go ConfigFiles).
cp "${SRC}/packaging/rpm/sysconfig/grafana-server"        "${PKG}/etc/sysconfig/grafana-server"
cp "${SRC}/packaging/rpm/systemd/grafana-server.service"  "${PKG}/usr/lib/systemd/system/grafana-server.service"
# Config files must have 0644 or less permissive (DISA-STIG RHEL-09-232020).
chmod 0644 "${PKG}/etc/sysconfig/grafana-server"

FILENAME="${TARGZ_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_${OS}_${ARCH_LABEL}.rpm"

mkdir -p dist

fpm \
  --input-type=dir \
  --chdir="${PKG}" \
  --output-type=rpm \
  --vendor="Grafana Labs" \
  --url=https://grafana.com \
  --maintainer=contact@grafana.com \
  --version="${RPM_VERSION}" \
  --package="${REPO_ROOT}/dist/${FILENAME}" \
  --config-files=/etc/sysconfig/grafana-server \
  --config-files=/usr/lib/systemd/system/grafana-server.service \
  --after-install="${SRC}/packaging/rpm/control/postinst" \
  --architecture="${PKG_ARCH}" \
  --description=Grafana \
  --license="${FPM_LICENSE:-AGPLv3}" \
  --name="${TARGZ_PACKAGE_NAME}" \
  --rpm-posttrans="${SRC}/packaging/rpm/control/posttrans" \
  --rpm-digest=sha256 \
  --rpm-compression xzmt \
  --rpm-user root \
  --rpm-group root \
  .

echo "created dist/${FILENAME}"
