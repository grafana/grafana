#!/usr/bin/env bash
set -e

GRAFANA_TAG=${1:-}

if echo "$GRAFANA_TAG" | grep -q "^v"; then
	_grafana_version=$(echo "${GRAFANA_TAG}" | cut -d "v" -f 2)
else
  echo "Provided tag is not a version tag, skipping packages release..."
	exit
fi

echo "Retrieving prerelease NPM artifacts"
ZIPFILE=grafana-npm-${_grafana_version}.tgz

echo "${GCP_KEY}" | base64 -d > credentials.json
gcloud auth activate-service-account --key-file=credentials.json
gsutil cp "gs://${PRERELEASE_BUCKET}/artifacts/npm/$ZIPFILE" "$ZIPFILE"
tar -xzf "$ZIPFILE"
