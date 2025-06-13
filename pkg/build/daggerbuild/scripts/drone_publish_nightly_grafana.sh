#!/usr/bin/env sh
set -e
# ver=$(cat ${GRAFANA_DIR}/package.json | jq -r .version | sed -E "s/$/-/" | sed -E "s/-.*/-${DRONE_BUILD_NUMBER}/")
local_dir="${DRONE_WORKSPACE}/dist"

# Publish the docker images present in the bucket
dagger run --silent go run ./pkg/build/cmd docker publish \
  $(find $local_dir | grep docker.tar.gz | grep -v sha256 | awk '{print "--package=file://"$0}') \
  --username=${DOCKER_USERNAME} \
  --password=${DOCKER_PASSWORD} \
  --repo="grafana-dev"

# Publish packages to the downloads bucket
dagger run --silent go run ./pkg/build/cmd package publish \
  $(find $local_dir | grep -e .rpm -e .tar.gz -e .exe -e .zip -e .deb | awk '{print "--package=file://"$0}') \
  --gcp-service-account-key-base64=${GCP_KEY_BASE64} \
  --destination="${DOWNLOADS_DESTINATION}/oss/release"

# Publish only the linux/amd64 edition storybook into the storybook bucket
# dagger run --silent go run ./pkg/build/cmd storybook \
#   $(find $local_dir | grep tar.gz | grep linux | grep amd64 | grep -v sha256 | grep -v docker | awk '{print "--package=file://"$0}') \
#   --gcp-service-account-key-base64=${GCP_KEY_BASE64} \
#   --destination="${STORYBOOK_DESTINATION}/${ver}"

# # Publish only the linux/amd64 edition static assets into the static assets bucket
# dagger run --silent go run ./pkg/build/cmd cdn \
#   $(find $local_dir | grep tar.gz | grep linux | grep amd64 | grep -v sha256 | grep -v docker | awk '{print "--package=file://"$0}') \
#   --gcp-service-account-key-base64=${GCP_KEY_BASE64} \
#   --destination="${CDN_DESTINATION}/${ver}/public"

# Publish only the linux/amd64 edition npm packages to npm
dagger run --silent go run ./pkg/build/cmd npm publish \
  $(find $local_dir | grep tar.gz | grep linux | grep amd64 | grep -v sha256 | grep -v docker | awk '{print "--package=file://"$0}') \
  --token=${NPM_TOKEN} \
  --tag="nightly"

# Publish packages to grafana.com
dagger run --silent go run ./pkg/build/cmd gcom publish \
  $(find $local_dir | grep -e .rpm -e .tar.gz -e .exe -e .zip -e .deb | grep -v sha256 | grep -v docker | awk '{print "--package=file://"$0}') \
  --api-key=${GCOM_API_KEY} \
  --api-url="https://grafana.com/api/grafana" \
  --download-url="https://dl.grafana.com/oss/release" \
  --nightly
