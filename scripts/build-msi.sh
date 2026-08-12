#!/usr/bin/env bash
set -euo pipefail

# Builds a Windows MSI installer from a pre-built tar.gz using Wine + WiX3 in Docker.
#
# Environment variables:
#   TARGZ_PACKAGE_NAME  – package name, e.g. "grafana" or "grafana-enterprise" (default: grafana)
#   BUILD_VERSION       – semver build version (required)
#   BUILD_NUMBER        – CI build number / ID (default: local)
#   ENTERPRISE          – "true" to build enterprise installer (default: false)

: "${TARGZ_PACKAGE_NAME:=grafana}"
: "${BUILD_VERSION:?BUILD_VERSION is required}"
: "${BUILD_NUMBER:=local}"
: "${ENTERPRISE:=false}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PACKAGING_DIR="${REPO_ROOT}/packaging/msi"

# Convert a grafana semver string to a 4-part MSI version (x.y.z.build).
wxs_version() {
  local v="${1#v}"
  local major minor patch

  major="$(echo "$v" | cut -d. -f1)"
  minor="$(echo "$v" | cut -d. -f2)"
  # strip pre-release / build-metadata from patch field
  patch="$(echo "$v" | cut -d. -f3 | cut -d- -f1 | cut -d+ -f1)"

  # build metadata: x.y.z+security-20240101 → x.y.z.20240101
  if [[ "$v" == *+* ]]; then
    local build="${v#*+}"
    build="${build#security-}"
    echo "${major}.${minor}.${patch}.${build}"
    return
  fi

  # pre-release: x.y.z-pre12345 → x.y.z.12345
  if [[ "$v" == *-* ]]; then
    local pre="${v#*-}"
    pre="${pre#beta}"
    pre="${pre#pre}"
    if [[ "$pre" == "local" ]]; then
      pre="0"
    fi
    if [[ ${#pre} -gt 5 ]]; then
      pre="${pre: -5}"
    fi
    echo "${major}.${minor}.${patch}.${pre}"
    return
  fi

  echo "${major}.${minor}.${patch}.0"
}

GRAFANA_VERSION="$(wxs_version "$BUILD_VERSION")"
FILENAME="${TARGZ_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_windows_amd64.msi"
TARGZ_FILE="${REPO_ROOT}/dist/${TARGZ_PACKAGE_NAME}_${BUILD_VERSION}_${BUILD_NUMBER}_windows_amd64.tar.gz"

if [[ ! -f "$TARGZ_FILE" ]]; then
  echo "error: tar.gz not found: ${TARGZ_FILE}" >&2
  exit 1
fi

if [[ "$ENTERPRISE" == "true" ]]; then
  UPGRADE_CODE="d534ec50-476b-4edc-a25e-fe854c949f4f"
  PRODUCT_NAME="GrafanaEnterprise"
  TITLE="Grafana Enterprise"
  LICENSE="EE_LICENSE.rtf"
else
  UPGRADE_CODE="35c7d2a9-6e23-4645-b975-e8693a1cef10"
  PRODUCT_NAME="GrafanaOSS"
  TITLE="Grafana OSS"
  LICENSE="LICENSE.rtf"
fi
MANUFACTURER="Grafana Labs"

WORK_DIR="$(mktemp -d)"
trap 'rm -rf "${WORK_DIR}"' EXIT

# Generate the product WXS from template; firewall and service are static.
export GRAFANA_VERSION UPGRADE_CODE PRODUCT_NAME TITLE MANUFACTURER LICENSE
envsubst < "${PACKAGING_DIR}/grafana-product.wxs.tpl" > "${WORK_DIR}/grafana-product.wxs"
cp "${PACKAGING_DIR}/grafana-firewall.wxs" "${WORK_DIR}/grafana-firewall.wxs"
cp "${PACKAGING_DIR}/grafana-service.wxs"  "${WORK_DIR}/grafana-service.wxs"

echo "building MSI: dist/${FILENAME}"

docker run --rm \
  --platform linux/amd64 \
  --entrypoint="" \
  -v "${TARGZ_FILE}:/tmp/grafana.tar.gz:ro" \
  -v "${PACKAGING_DIR}/resources:/src/resources:ro" \
  -v "${WORK_DIR}:/work" \
  scottyhardy/docker-wine:stable-10.0-20250608 \
  /bin/bash -c '
    set -euo pipefail

    mkdir -p /src

    # Download NSSM (Windows service manager)
    wget -q "https://dl.grafana.com/ci/nssm-2.24.zip" -O /tmp/nssm.zip
    unzip -q /tmp/nssm.zip -d /tmp/nssm
    mv /tmp/nssm/nssm-2.24 /src/nssm-2.24

    # Download WiX3 toolchain
    wget -q "https://github.com/wixtoolset/wix3/releases/download/wix3141rtm/wix314-binaries.zip" -O /tmp/wix.zip
    mkdir -p /src/wix3
    unzip -q /tmp/wix.zip -d /src/wix3

    # Extract grafana tar.gz, excluding files with paths too long for WiX
    mkdir -p /src/grafana
    tar -xzf /tmp/grafana.tar.gz -C /src/grafana --strip-components=1 \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_querystring_builder.test.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_querystring_builder.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_log_analytics/azure_log_analytics_datasource.test.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_log_analytics/azure_log_analytics_datasource.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_datasource.test.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_datasource.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_datasource.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/app_insights/app_insights_datasource.test.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/insights_analytics/insights_analytics_datasource.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_filter_builder.test.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/azure_monitor/azure_monitor_filter_builder.ts" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/components/AnalyticsConfig.test.tsx" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/components/AzureCredentialsForm.test.tsx" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/components/InsightsConfig.test.tsx" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/components/__snapshots__/AnalyticsConfig.test.tsx.snap" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/components/__snapshots__/AzureCredentialsForm.test.tsx.snap" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/components/__snapshots__/InsightsConfig.test.tsx.snap" \
      --exclude="*/public/app/plugins/datasource/grafana-azure-monitor-datasource/components/__snapshots__/ConfigEditor.test.tsx.snap" \
      --exclude="*/storybook"

    # Copy resources and generated WXS files into the working directory
    cp -r /src/resources/* /src/
    cp /work/*.wxs /src/
    cd /src

    # Step 1: harvest files into grafana.wxs
    WINEPATH="$(winepath /src/wix3)" wine heat dir /src/grafana \
      -platform x64 -sw5150 -srd \
      -cg GrafanaX64 -gg -sfrag \
      -dr GrafanaX64Dir \
      -template fragment \
      -out "$(winepath -w /src/grafana.wxs)"

    mkdir -p /root/.wine/drive_c/temp

    # Step 2: compile all .wxs files
    for wxs in grafana-service.wxs grafana-firewall.wxs grafana.wxs grafana-product.wxs; do
      WINEPATH="$(winepath /src/wix3)" wine candle \
        -ext WixFirewallExtension -ext WixUtilExtension \
        -v -arch x64 \
        "$(winepath -w /src/${wxs})"
    done

    # Step 3: link into MSI
    # -b sets the base path so light can resolve SourceDir\* paths harvested from /src/grafana
    WINEPATH="$(winepath /src/wix3)" wine light \
      -cultures:en-US \
      -ext WixUIExtension.dll \
      -ext WixFirewallExtension \
      -ext WixUtilExtension \
      -b "$(winepath -w /src/grafana)" \
      -v -sval -spdb \
      grafana-service.wixobj grafana-firewall.wixobj grafana.wixobj grafana-product.wixobj \
      -out "$(winepath -w /src/grafana.msi)"

    cp /src/grafana.msi /work/grafana.msi
  '

mkdir -p "${REPO_ROOT}/dist"
cp "${WORK_DIR}/grafana.msi" "${REPO_ROOT}/dist/${FILENAME}"
echo "created dist/${FILENAME}"
