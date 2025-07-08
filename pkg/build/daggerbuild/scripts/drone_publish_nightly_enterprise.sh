#!/usr/bin/env sh
set -e
local_dir="${DRONE_WORKSPACE}/dist"

# Publish the docker images present in the bucket
dagger run --silent go run ./pkg/build/cmd docker publish \
  $(find $local_dir | grep docker.tar.gz | grep -v sha256 | awk '{print "--package=file://"$0}') \
  --username=${DOCKER_USERNAME} \
  --password=${DOCKER_PASSWORD} \
  --latest \
  --repo="grafana-enterprise-dev"

# Publish packages to the downloads bucket
dagger run --silent go run ./pkg/build/cmd package publish \
  $(find $local_dir | grep -e .rpm -e .tar.gz -e .exe -e .zip -e .deb | awk '{print "--package=file://"$0}') \
  --gcp-service-account-key-base64=${GCP_KEY_BASE64} \
  --destination="${DOWNLOADS_DESTINATION}/enterprise/release"

# Publish packages to grafana.com
dagger run --silent go run ./pkg/build/cmd gcom publish \
  $(find $local_dir | grep -e .rpm -e .tar.gz -e .exe -e .zip -e .deb | grep -v sha256 | grep -v docker | awk '{print "--package=file://"$0}') \
  --api-key=${GCOM_API_KEY} \
  --api-url="https://grafana.com/api/grafana-enterprise" \
  --download-url="https://dl.grafana.com/enterprise/release" \
  --nightly
