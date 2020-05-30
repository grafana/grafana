#/bin/bash
set -xeo pipefail

chmod +x grabpl
# TODO: Depend on whether we build a release, a test release or a master/PR branch
# TODO: Parameterize edition
./grabpl build-frontend --github-token "${GITHUB_GRAFANABOT_TOKEN}" --edition oss --build-id $GITHUB_RUN_ID
