#/bin/bash
set -xeo pipefail

chmod +x grabpl
# TODO: Parameterize edition
./grabpl build-backend --github-token "${GITHUB_GRAFANABOT_TOKEN}" --edition oss --build-id $GITHUB_RUN_ID
