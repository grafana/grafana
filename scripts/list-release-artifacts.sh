#!/usr/bin/env bash
set -e

VERSION="${1:-v9.5.2}"
ERSION="${VERSION#*v}"
ERSION_DEB="${ERSION//-/\~}"

# Unused assets:
# gs://${BUCKET}/artifacts/static-assets/grafana/${ERSION}/public/robots.txt
# gs://${BUCKET}/artifacts/static-assets/grafana-oss/${ERSION}/public/robots.txt

ASSETS=$(cat << EOF
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION_DEB}-1.aarch64.rpm
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION_DEB}-1.aarch64.rpm.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION_DEB}-1.x86_64.rpm
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION_DEB}-1.x86_64.rpm.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.darwin-amd64.tar.gz
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.darwin-amd64.tar.gz.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-amd64-musl.tar.gz
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-amd64-musl.tar.gz.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-amd64.tar.gz
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-amd64.tar.gz.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-arm64-musl.tar.gz
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-arm64-musl.tar.gz.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-arm64.tar.gz
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-arm64.tar.gz.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-armv6.tar.gz
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-armv6.tar.gz.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-armv7-musl.tar.gz
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-armv7-musl.tar.gz.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-armv7.tar.gz
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.linux-armv7.tar.gz.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.windows-amd64.msi
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.windows-amd64.msi.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.windows-amd64.zip
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-${ERSION}.windows-amd64.zip.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-rpi_${ERSION_DEB}_armhf.deb
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana-rpi_${ERSION_DEB}_armhf.deb.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana_${ERSION_DEB}_amd64.deb
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana_${ERSION_DEB}_amd64.deb.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana_${ERSION_DEB}_arm64.deb
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana_${ERSION_DEB}_arm64.deb.sha256
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana_${ERSION_DEB}_armhf.deb
gs://${BUCKET}/artifacts/downloads/${VERSION}/oss/release/grafana_${ERSION_DEB}_armhf.deb.sha256
gs://${BUCKET}/artifacts/docker/${ERSION}/grafana-oss-${ERSION}-amd64.img
gs://${BUCKET}/artifacts/docker/${ERSION}/grafana-oss-${ERSION}-arm64.img
gs://${BUCKET}/artifacts/docker/${ERSION}/grafana-oss-${ERSION}-armv7.img
gs://${BUCKET}/artifacts/docker/${ERSION}/grafana-oss-${ERSION}-ubuntu-amd64.img
gs://${BUCKET}/artifacts/docker/${ERSION}/grafana-oss-${ERSION}-ubuntu-arm64.img
gs://${BUCKET}/artifacts/docker/${ERSION}/grafana-oss-${ERSION}-ubuntu-armv7.img
EOF
)

echo "${ASSETS}" | envsubst
