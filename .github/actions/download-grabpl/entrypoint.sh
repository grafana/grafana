#/bin/bash
set -eo pipefail

curl -fLO https://grafana-downloads.storage.googleapis.com/grafana-build-pipeline/v${GRABPL_VERSION}/grabpl
chmod +x grabpl
